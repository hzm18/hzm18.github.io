---
icon: edit
date: 2022-09-04
category:
  - 后端
  - Java
tag:
  - JUC
  - AQS
---


# AbstractQueuedSynchronizer

> Provides a framework for implementing blocking locks and related synchronizers (semaphores, events, etc) that rely on first-in-first-out (FIFO) wait queues.
>
> 提供一个框架来实现依赖于先进先出 (FIFO) 等待队列的阻塞锁和相关的同步器（信号量、事件等）

等待队列是"CLH"锁定队列的变体。

包括`ReentrantLock`、`Semaphore`等都是使用`AQS`完成。



本文的源码参考自`Oracle Open JDK 18`。

## AQS本类中的部分字段、方法

```java
// 独占模式的Node，只能由一个线程获取，如可重入锁ReenterantLock
static final class ExclusiveNode extends Node { }
// 共享模式的Node，可同时被多个线程获取，如信号量Semaphore等
static final class SharedNode extends Node { }
```

关于`CLH Nodes`的`status`的常量定义：

```java
static final int WAITING   = 1;          // must be 1
static final int CANCELLED = 0x80000000; // must be negative
static final int COND      = 2;          // in a condition wait
```

部分字段：

```java
/**
* 等待队列的头节点，当node第一次加入队列时初始化
*/
private transient volatile Node head;

/**
* 等待队列的尾节点，初始化后只能通过 #casTail方法 以CAS的方式修改
*/
private transient volatile Node tail;

/**
* 同步状态值
*/
private volatile int state;

// Unsafe类
private static final Unsafe U = Unsafe.getUnsafe();
// AQS中state字段偏移
private static final long STATE = U.objectFieldOffset(AbstractQueuedSynchronizer.class, "state");
// AQS中头节点字的偏移
private static final long HEAD = U.objectFieldOffset(AbstractQueuedSynchronizer.class, "head");
// AQS中尾节点字段偏移
private static final long TAIL = U.objectFieldOffset(AbstractQueuedSynchronizer.class, "tail");
```

部分方法：

```java
/*
* CAS方式修改state
*/
protected final boolean compareAndSetState(int expect, int update) {
	return U.compareAndSetInt(this, STATE, expect, update);
}

/*
* CAS方式修改等待队列尾节点
*/
private boolean casTail(Node c, Node v) {
    return U.compareAndSetReference(this, TAIL, c, v);
}

/*
* 尝试初始化等待列表头节点
* 使用一个ExclusiveNode的dummy node通过CAS方式设置为头节点
*/
private void tryInitializeHead() {
    Node h = new ExclusiveNode();
    if (U.compareAndSetReference(this, HEAD, null, h))
        tail = h;
}

/*
* 将node塞入等待队列
*/
final void enqueue(Node node) {
    if (node != null) {
        for (;;) {
            Node t = tail;
            node.setPrevRelaxed(t);        // 设置node前驱节点为现尾节点 (原注释:avoid unnecessary fence.为什么能避免不必要的fence?)
            if (t == null)                 // 如果尾节点为空，则尝试初始化头节点
                tryInitializeHead();	   // 尝试后继续
            else if (casTail(t, node)) {   // 尝试修改尾节点tail为node
                t.next = node;			   // 将旧尾节点的后继节点修改为node
                if (t.status < 0)          // wake up to clean link
                    LockSupport.unpark(node.waiter);
                break;
            }
        }
    }
}

/*
* 从等待队列从后往前找，node是否已经在队列中
*/
final boolean isEnqueued(Node node) {
    for (Node t = tail; t != null; t = t.prev)
        if (t == node)
            return true;
    return false;
}

/**
* 唤醒给定节点h的后继节点（如果有）
*/
private static void signalNext(Node h) {
    Node s;
    if (h != null && (s = h.next) != null && s.status != 0) {
        s.getAndUnsetStatus(WAITING);	// 将给定节点的后继节点的WAITING去掉
        LockSupport.unpark(s.waiter);	// 唤醒后继节点的等待线程
    }
}

```

还有代码比较长的`acquire`方法：

```java
final int acquire(Node node, int arg, boolean shared,
                      boolean interruptible, boolean timed, long time) {
        Thread current = Thread.currentThread();
        byte spins = 0, postSpins = 0;   // retries upon unpark of first thread
        boolean interrupted = false,	 // 当前是否已有中断
    			first = false;			 // 是否为第一个节点（非dummy head）
        Node pred = null;                // predecessor of node when enqueued

        /*
         * Repeatedly:
         *  Check if node now first
         *    if so, ensure head stable, else ensure valid predecessor
         *  if node is first or not yet enqueued, try acquiring
         *  else if node not yet created, create it
         *  else if not yet enqueued, try once to enqueue
         *  else if woken from park, retry (up to postSpins times)
         *  else if WAITING status not set, set and retry
         *  else park and clear WAITING status, and check cancellation
         */

        for (;;) {
            if (!first && (pred = (node == null) ? null : node.prev) != null &&
                !(first = (head == pred))) {	// 如果已经初始化了，
                if (pred.status < 0) {
                    cleanQueue();           // predecessor cancelled
                    continue;
                } else if (pred.prev == null) {
                    Thread.onSpinWait();    // ensure serialization
                    continue;
                }
            }
            if (first || pred == null) {	// 
                boolean acquired;
                try {
                    if (shared)
                        acquired = (tryAcquireShared(arg) >= 0);
                    else
                        acquired = tryAcquire(arg);				// 再次尝试以独占模式获取
                } catch (Throwable ex) {
                    cancelAcquire(node, interrupted, false);	// 异常了，取消获取
                    throw ex;
                }
                if (acquired) {
                    if (first) {						// 如果获取成功且为第一次
                        node.prev = null;				// 设置node的前驱节点为null
                        head = node;					// 当前的头节点设置为node
                        pred.next = null;				// 前驱节点
                        node.waiter = null;				// 
                        if (shared)
                            signalNextIfShared(node);
                        if (interrupted)
                            current.interrupt();
                    }
                    return 1;
                }
            }
            if (node == null) {                 // 如果传入的node为空则根据shared选择创建共享还是排他的node
                if (shared)
                    node = new SharedNode();
                else
                    node = new ExclusiveNode();
            } else if (pred == null) {          // 前驱节点为空，意味着第一次入队
                node.waiter = current;			// 把传入的node或之前创建的node设置其waiter线程为当前线程
                Node t = tail;
                node.setPrevRelaxed(t);         // avoid unnecessary fence
                if (t == null)
                    tryInitializeHead();		// 如果t(即tail)为空，则初始化队列（塞入dummy node）
                else if (!casTail(t, node))		// CAS尝试把该node设置到tail字段
                    node.setPrevRelaxed(null);  // 失败了就放弃刚刚设置的t（下次重试）
                else
                    t.next = node;				// 如果CAS替换tail字段成功则设置旧的tail节点的next为node
            } else if (first && spins != 0) {
                --spins;                        // reduce unfairness on rewaits
                Thread.onSpinWait();			// NOOP，可能后面虚拟机会有相关优化？（比如自旋时减少CPU占用？）
            } else if (node.status == 0) {		// 检查一下如果status为0则设置为等待的状态值
                node.status = WAITING;          // 设置为等待的状态值
            } else {
                long nanos;
                spins = postSpins = (byte)((postSpins << 1) | 1);
                if (!timed)
                    LockSupport.park(this);		// 如果没有等待时间参数，则立即将将线程进入等待
                else if ((nanos = time - System.nanoTime()) > 0L)
                    LockSupport.parkNanos(this, nanos);	// 带时间的等待
                else
                    break;
                node.clearStatus();	// 唤醒后重置status为0
                if ((interrupted |= Thread.interrupted()) && interruptible)
                    break;
            }
        }
        return cancelAcquire(node, interrupted, interruptible);
    }
```

关于取消获取的方法`cancelAcquire`如下：

```java
private int cancelAcquire(Node node, boolean interrupted,
                          boolean interruptible) {
    if (node != null) {
        node.waiter = null;			// 设置等待线程为null
        node.status = CANCELLED;	// 状态设置为取消
        if (node.prev != null)		// 如果该节点的前驱节点不为空则尝试清理队列中
            cleanQueue();
    }
    if (interrupted) {
        if (interruptible)
            return CANCELLED;
        else
            Thread.currentThread().interrupt();
    }
    return 0;
}
```

清理队列方法`cleanQueue`：

```java
private void cleanQueue() {
    for (;;) {                               // 不断进行重试
        for (Node q = tail, s = null, p, n;;) {		// p->q->s
            if (q == null || (p = q.prev) == null)
                return;                      // 判断下是否已经处理到最后的节点了
            if (s == null ? tail != q : (s.prev != q || s.status < 0))
                break;                       // 检查一下如果节点间关系或状态不对就重来
            if (q.status < 0) {              // 如果遍历到的节点是取消状态
                // 如果是tail节点则执行casTail将tail替换为tail的前驱节点；
                // 否则，由于是从后往前处理，把后面第一个的非取消状态的节点s接到它的前驱的前驱节点p，
                // 相当于把q断开了，同时判断一下关系q的前驱节点确实是p的条件
                if ((s == null ? casTail(q, p) : s.casPrev(q, p)) && q.prev == p) {
                    p.casNext(q, s);         // 修改下已经是s的前驱节点的p的后继节点为s（CAS失败了可以忽略）
                    if (p.prev == null)		 // 如果p的前驱节点为空意味着当前已经head了
                        signalNext(p);		 // 立即去掉下一个等待中的node的等待状态并唤醒该node的等待线程
                }
                break;
            }
            // 如果p.next == q，但是q.prev != p，则尝试修复这个关联关系
            if ((n = p.next) != q) {         // help finish
                if (n != null && q.prev == p) {	
                    p.casNext(n, q);
                    if (p.prev == null)		// 如果p的前驱节点为空意味着当前已经head了
                        signalNext(p);		// 立即去掉下一个等待中的node的等待状态并唤醒该node的等待线程
                }
                break;
            }
            s = q;		// 保存当前节点
            q = q.prev;	// 旧的当前节点往前挪
        }
    }
}
```

尝试获取独占锁`acquire`：

```java
public final void acquire(int arg) {
    if (!tryAcquire(arg))	// 尝试获取锁，失败了则把当前线程加入等待队列中
        acquire(null, arg, false, false, false, 0L);
}
```

释放，解除线程阻塞`release`：

```java
public final boolean release(int arg) {
    if (tryRelease(arg)) {	// 尝试解锁，由子类实现，返回true则尝试唤醒第一个真实的等待节点
        signalNext(head);
        return true;
    }
    return false;
}
```



## 抽象静态内部类Node

等待队列中塞入的元素是`AQS`类中的抽象静态内部类`Node`的子类。

```java
abstract static class Node {
    volatile Node prev;       // 前驱节点，初始化时将设置为dummy node
    volatile Node next;       // visibly nonnull when signallable
    Thread waiter;            // 排队等待的线程
    volatile int status;      // written by owner, atomic bit ops by others

    // 定义了一些**atomic**操作的方法
    final boolean casPrev(Node c, Node v) {  // 通过CAS交换前驱节点
        return U.weakCompareAndSetReference(this, PREV, c, v);
    }
    final boolean casNext(Node c, Node v) {  // 通过CAS交换后继节点
        return U.weakCompareAndSetReference(this, NEXT, c, v);
    }
    final int getAndUnsetStatus(int v) {     // 获取当前status且unset掉传入的为v的bit
        return U.getAndBitwiseAndInt(this, STATUS, ~v);
    }
    final void setPrevRelaxed(Node p) {      // 设置前驱节点值
        U.putReference(this, PREV, p);
    }
    final void setStatusRelaxed(int s) {     // 设置status值
        U.putInt(this, STATUS, s);
    }
    final void clearStatus() {               // 设置status为0,使用volatile设置
        U.putIntOpaque(this, STATUS, 0);
    }
	
    // 先使用Unsafe保存Node类上该field的offset，便于后面Unsafe对该字段的atomic操作
    private static final long STATUS = U.objectFieldOffset(Node.class, "status");
    private static final long NEXT = U.objectFieldOffset(Node.class, "next");
    private static final long PREV = U.objectFieldOffset(Node.class, "prev");
}
```

里面还有个类是`ConditionObject`，还不清楚，后面看了再说。
