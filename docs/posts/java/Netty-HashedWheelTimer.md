---
icon: edit
date: 2022-09-28
category:
  - 后端
  - Java
tag:
  - Netty
---

# HashedWheelTimer

## 例子

```xml
<dependency>
    <groupId>io.netty</groupId>
    <artifactId>netty-all</artifactId>
    <version>4.1.82.Final</version>
</dependency>
```

```java
public static void main(String[] args) throws InterruptedException {
    CountDownLatch countDownLatch = new CountDownLatch(1);
    HashedWheelTimer timer = new HashedWheelTimer(1, TimeUnit.MINUTES, 16);
    System.out.println("current timestamp=" + System.currentTimeMillis());
    timer.newTimeout((timeout) -> {
        System.out.println(timeout.isExpired());
        System.out.println("task execute,current timestamp=" + System.currentTimeMillis());
        countDownLatch.countDown();
    }, 30, TimeUnit.SECONDS);

    countDownLatch.await(); 
    timer.stop();
}
```



## HashedWheelTimer的一些东西

```java
public HashedWheelTimer(
    ThreadFactory threadFactory,
    long tickDuration, TimeUnit unit, int ticksPerWheel, boolean leakDetection,
    long maxPendingTimeouts, Executor taskExecutor) {

    checkNotNull(threadFactory, "threadFactory");
    checkNotNull(unit, "unit");
    checkPositive(tickDuration, "tickDuration");
    checkPositive(ticksPerWheel, "ticksPerWheel");
    this.taskExecutor = checkNotNull(taskExecutor, "taskExecutor");

    // 创建HashedWheelBucket[]，检查ticksPerWheel不超过2^30且会normalize成2^N（>=ticksPerWheel）
    wheel = createWheel(ticksPerWheel);
    mask = wheel.length - 1;

    // 将tick时长统一换算为纳秒
    long duration = unit.toNanos(tickDuration);

    // 如果tick时长超过
    if (duration >= Long.MAX_VALUE / wheel.length) {
        throw new IllegalArgumentException(String.format(
            "tickDuration: %d (expected: 0 < tickDuration in nanos < %d",
            tickDuration, Long.MAX_VALUE / wheel.length));
    }
		// 如果小于1毫秒则重置成1毫秒
    if (duration < MILLISECOND_NANOS) {
        logger.warn("Configured tickDuration {} smaller than {}, using 1ms.",
                    tickDuration, MILLISECOND_NANOS);
        this.tickDuration = MILLISECOND_NANOS;
    } else {
        this.tickDuration = duration;
    }

    // 创建一条工作线程用来运行work
    workerThread = threadFactory.newThread(worker);

    // 泄漏检测
    leak = leakDetection || !workerThread.isDaemon() ? leakDetector.track(this) : null;

    // 最多pending的timeout数，如添加timeout时超过了则抛出异常RejectedExecutionException，默认为-1即无限制
    this.maxPendingTimeouts = maxPendingTimeouts;
    
	// 如果HashedWheelTimer实例数超过限制（INSTANCE_COUNT_LIMIT为64），则warn一次
    if (INSTANCE_COUNTER.incrementAndGet() > INSTANCE_COUNT_LIMIT &&
        WARNED_TOO_MANY_INSTANCES.compareAndSet(false, true)) {
        reportTooManyInstances();
    }
}
```

加入一个timeout其实不是直接就找到bucket就加入到其中的链表，而是先放到队列中，每过一次tick再取出来把它们放到对应的bucket中去

```java
public Timeout newTimeout(TimerTask task, long delay, TimeUnit unit) {
    checkNotNull(task, "task");
    checkNotNull(unit, "unit");
    
    long pendingTimeoutsCount = pendingTimeouts.incrementAndGet();

    if (maxPendingTimeouts > 0 && pendingTimeoutsCount > maxPendingTimeouts) {
        pendingTimeouts.decrementAndGet();
        throw new RejectedExecutionException("Number of pending timeouts ("
            + pendingTimeoutsCount + ") is greater than or equal to maximum allowed pending "
            + "timeouts (" + maxPendingTimeouts + ")");
    }
    // 尝试修改state为开始状态
    start();

    // Add the timeout to the timeout queue which will be processed on the next tick.
    // During processing all the queued HashedWheelTimeouts will be added to the correct HashedWheelBucket.
    long deadline = System.nanoTime() + unit.toNanos(delay) - startTime;

    // Guard against overflow.
    if (delay > 0 && deadline < 0) {
        deadline = Long.MAX_VALUE;
    }
    // 创建一个timeout,并加入到timeouts的队列中，该队列是JCTools的MpscQueue
    HashedWheelTimeout timeout = new HashedWheelTimeout(this, task, deadline);
    timeouts.add(timeout);
    return timeout;
}
```

## 内部的几个类：

### HashedWheelBucket

```java
private static final class HashedWheelBucket {
        // 链表结构，在bucket中保存它的头尾节点，timeout中保存前驱后继节点
        private HashedWheelTimeout head;
        private HashedWheelTimeout tail;

        /**
         * 添加HashedWheelTimeout到bucket中
         */
        public void addTimeout(HashedWheelTimeout timeout) {
            assert timeout.bucket == null;
            timeout.bucket = this;
            if (head == null) {
                head = tail = timeout;
            } else {
                tail.next = timeout;
                timeout.prev = tail;
                tail = timeout;
            }
        }

        /**
         * Expire all {@link HashedWheelTimeout}s for the given {@code deadline}.
         */
        public void expireTimeouts(long deadline) {
            HashedWheelTimeout timeout = head;

            // process all timeouts
            while (timeout != null) {
                HashedWheelTimeout next = timeout.next;
                // 如果rounds小于等于0则进入
                if (timeout.remainingRounds <= 0) {
                    // 从timeout链表移除掉
                    next = remove(timeout);
                    // 判断deadline是否已经过了
                    if (timeout.deadline <= deadline) {
                        // 设置timeout的状态并执行回调
                        timeout.expire();
                    } else {
                        // The timeout was placed into a wrong slot. This should never happen.
                        throw new IllegalStateException(String.format(
                                "timeout.deadline (%d) > deadline (%d)", timeout.deadline, deadline));
                    }
                } else if (timeout.isCancelled()) {
                    next = remove(timeout);
                } else {
                    // 经过一轮则将rounds递减1
                    timeout.remainingRounds --;
                }
                timeout = next;
            }
        }

        public HashedWheelTimeout remove(HashedWheelTimeout timeout) {...}

        /**
         * Clear this bucket and return all not expired / cancelled {@link Timeout}s.
         */
        public void clearTimeouts(Set<Timeout> set) {...}

        private HashedWheelTimeout pollTimeout() {...}
    }
}
```

### HashedWheelTimeout

该类中保存了任务的一些东西，例如它的前驱后继timeout、轮数、任务（Runnable）、deadline以及一些操作状态、timeout从bucket中移除之类的方法。

以下是部分代码：

```java
private static final class HashedWheelTimeout implements Timeout, Runnable {

    private static final int ST_INIT = 0;       // 初始化状态
    private static final int ST_CANCELLED = 1;  // timeout取消状态
    private static final int ST_EXPIRED = 2;    // timeout过期状态
    private static final AtomicIntegerFieldUpdater<HashedWheelTimeout> STATE_UPDATER =
            AtomicIntegerFieldUpdater.newUpdater(HashedWheelTimeout.class, "state");    // 状态字段state的AtomicFieldUpdater
    private final HashedWheelTimer timer;       // timer
    private final TimerTask task;               // timeout到期了要执行的任务
    private final long deadline;                // timeout的到期时间

    @SuppressWarnings({"unused", "FieldMayBeFinal", "RedundantFieldInitialization" })
    private volatile int state = ST_INIT;       // 状态字段，初始值为0


    long remainingRounds;                       // 轮数

    // This will be used to chain timeouts in HashedWheelTimerBucket via a double-linked-list.
    // As only the workerThread will act on it there is no need for synchronization / volatile.
    HashedWheelTimeout next;                    // next节点
    HashedWheelTimeout prev;                    // prev节点

    // The bucket to which the timeout was added
    HashedWheelBucket bucket;                   // timeout所属的bucket

    HashedWheelTimeout(HashedWheelTimer timer, TimerTask task, long deadline) {
        this.timer = timer;
        this.task = task;
        this.deadline = deadline;
    }

    @Override
    public boolean cancel() {
        // 修改timeout为取消状态
        if (!compareAndSetState(ST_INIT, ST_CANCELLED)) {
            return false;
        }
        // 放入取消的timeout队列中
        timer.cancelledTimeouts.add(this);
        return true;
    }

    void remove() {
        HashedWheelBucket bucket = this.bucket;
        if (bucket != null) {
            bucket.remove(this);
        } else {
            timer.pendingTimeouts.decrementAndGet();
        }
    }

    public boolean compareAndSetState(int expected, int state) {
        return STATE_UPDATER.compareAndSet(this, expected, state);
    }

    public void expire() {
        // 设置为expire状态
        if (!compareAndSetState(ST_INIT, ST_EXPIRED)) {
            return;
        }

        try {
            // 执行timeout的任务
            timer.taskExecutor.execute(this);
        } catch (Throwable t) {
            if (logger.isWarnEnabled()) {
                logger.warn("An exception was thrown while submit " + TimerTask.class.getSimpleName()
                        + " for execution.", t);
            }
        }
    }

    /**
    * 实现了Runnable
    */
    @Override
    public void run() {
        try {
            task.run(this);
        } catch (Throwable t) {
            if (logger.isWarnEnabled()) {
                logger.warn("An exception was thrown by " + TimerTask.class.getSimpleName() + '.', t);
            }
        }
    }
}
```

### Worker

```java
private final class Worker implements Runnable {
    private final Set<Timeout> unprocessedTimeouts = new HashSet<Timeout>();

    private long tick;

    @Override
    public void run() {
        // Initialize the startTime.
        startTime = System.nanoTime();
        if (startTime == 0) {
            // We use 0 as an indicator for the uninitialized value here, so make sure it's not 0 when initialized.
            startTime = 1;
        }

        // newTimeout那里等待初始化startTime
        startTimeInitialized.countDown();

        do {
            final long deadline = waitForNextTick();
            if (deadline > 0) {
                int idx = (int) (tick & mask);
                processCancelledTasks();                // remove已经取消的timeout
                HashedWheelBucket bucket = wheel[idx];  // 本次tick中要处理的bucket
                transferTimeoutsToBuckets();            // 本次tick中从队列中分配timeout到bucket中
                bucket.expireTimeouts(deadline);        // 处理本次选中的bucket中已过期的timeout执行其任务或round减1
                tick++;                                 // 递增tick
            }
        } while (WORKER_STATE_UPDATER.get(HashedWheelTimer.this) == WORKER_STATE_STARTED);  // 判断状态是否处于STARTED

        // 走到这意味着state为shutdown了
        for (HashedWheelBucket bucket: wheel) {
            // 遍历已经在bucket的timeouts，清除并且将非cancel和非expired的加到unprocessedTimeouts中
            bucket.clearTimeouts(unprocessedTimeouts);
        }
        for (;;) {
            // 不在bucket而在队列中的timeouts不是expired的，但是为cancelled的排除掉，
            // 即找出正常状态还没有处理的timeouts添加到unprocessedTimeouts中
            HashedWheelTimeout timeout = timeouts.poll();
            if (timeout == null) {
                break;
            }
            if (!timeout.isCancelled()) {
                unprocessedTimeouts.add(timeout);
            }
        }
        processCancelledTasks();
    }

    private void transferTimeoutsToBuckets() {
        // transfer only max. 100000 timeouts per tick to prevent a thread to stale the workerThread when it just
        // adds new timeouts in a loop.
        for (int i = 0; i < 100000; i++) {  // 每次tick取100000个分配到bucket中
            HashedWheelTimeout timeout = timeouts.poll();
            if (timeout == null) {
                // all processed
                break;
            }
            if (timeout.state() == HashedWheelTimeout.ST_CANCELLED) {
                // Was cancelled in the meantime.
                continue;
            }

            long calculated = timeout.deadline / tickDuration;
            timeout.remainingRounds = (calculated - tick) / wheel.length;

            final long ticks = Math.max(calculated, tick); // Ensure we don't schedule for past.
            int stopIndex = (int) (ticks & mask);   // 模定位

            HashedWheelBucket bucket = wheel[stopIndex];    // 塞到对应位置的bucket链表
            bucket.addTimeout(timeout);
        }
    }

    private void processCancelledTasks() {
        for (;;) {
            HashedWheelTimeout timeout = cancelledTimeouts.poll();
            if (timeout == null) {
                // all processed
                break;
            }
            try {
                timeout.remove();
            } catch (Throwable t) {
                if (logger.isWarnEnabled()) {
                    logger.warn("An exception was thrown while process a cancellation task", t);
                }
            }
        }
    }

    /**
        * calculate goal nanoTime from startTime and current tick number,
        * then wait until that goal has been reached.
        * @return Long.MIN_VALUE if received a shutdown request,
        * current time otherwise (with Long.MIN_VALUE changed by +1)
        */
    private long waitForNextTick() {
        long deadline = tickDuration * (tick + 1);

        for (;;) {
            final long currentTime = System.nanoTime() - startTime;
            long sleepTimeMs = (deadline - currentTime + 999999) / 1000000;

            if (sleepTimeMs <= 0) {
                if (currentTime == Long.MIN_VALUE) {
                    return -Long.MAX_VALUE;
                } else {
                    return currentTime;
                }
            }

            // Check if we run on windows, as if thats the case we will need
            // to round the sleepTime as workaround for a bug that only affect
            // the JVM if it runs on windows.
            //
            // See https://github.com/netty/netty/issues/356
            if (PlatformDependent.isWindows()) {
                sleepTimeMs = sleepTimeMs / 10 * 10;
                if (sleepTimeMs == 0) {
                    sleepTimeMs = 1;
                }
            }

            try {
                Thread.sleep(sleepTimeMs);
            } catch (InterruptedException ignored) {
                if (WORKER_STATE_UPDATER.get(HashedWheelTimer.this) == WORKER_STATE_SHUTDOWN) {
                    return Long.MIN_VALUE;
                }
            }
        }
    }

    public Set<Timeout> unprocessedTimeouts() {
        return Collections.unmodifiableSet(unprocessedTimeouts);
    }
}
```

