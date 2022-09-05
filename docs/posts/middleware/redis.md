---
icon: edit
date: 2022-09-05
category:
  - 中间件
  - Redis
tag:
  - cache
  - redis
---


# WIP: Redis的一些知识

> Redis是一个开源（BSD）的内存**数据结构存储**，用作数据库、缓存、消息代理和流引擎。

平时还是使用Redisson比较多呀...

## 数据类型

### string（字符串）

Redis 字符串存储字节序列，包括文本、序列化对象和二进制数组。 

因此，字符串是最基本的 Redis 数据类型。 它们通常用于缓存，但它们支持额外的功能，让您也可以实现**计数器**并执行按位操作。 

**默认情况下，单个Redis字符串最大为512MB**

#### 常用命令

##### 存储字符串

```bash
SET key value
```

`key`为键，`value`为值

```
SET name kellyton
```

可以在存储的时候指定key的过期时间（以下语句设置过期时间为从现在起60秒后）：

```
SET name kellyton EX 60
```

##### 读取字符串

```
GET key
```

示例

```
> GET name
"kellyton"
```

仅当key不存在时才存储值。用于实现锁。

```
SETNX name value
```

如果名为`name`的key已存在，响应`"0"`，否则响应`"1"`

##### 单次操作读取多个key的value

```
> MGET key1 key2 key3 ...
1) "value1"
2) "value2"
3) null
```

##### 计数器

使用`INCRBY`原子方式递增value（负数为递减）。

```
> SET c 10
"OK"
> INCRBY c 11
"21"
```

### list（列表）

字符串值的链表，可用于实现栈和队列。

**Redis 列表的最大长度为 2^32 - 1 (4,294,967,295) 个元素。** 

#### 常用命令

```
LPUSH：将一个新元素添加到列表的头部； 
RPUSH：将一个新元素添加到添加到尾部；
LPOP：从列表的头部移除并返回一个元素；
RPOP：从列表的尾部移除并返回一个元素；
LLEN：返回列表的长度。
LMOVE：原子地将元素从一个列表移动到另一个列表。
LTRIM：将列表减少到指定的元素范围。
```

list还支持几个阻塞命令：

```
BLPOP：从列表的头部删除并返回一个元素。 如果列表为空，则命令会阻塞，直到元素可用或达到指定的超时。 
BLMOVE：原子地将元素从源列表移动到目标列表。 如果源列表为空，则该命令将阻塞，直到有新元素可用。
```

### sets（集合）

Redis sets是无序不重复的字符串成员的集合，

**每个散列最多可以存储 4,294,967,295 (2^32 - 1) 个字段-值对。 实际上受总内存限制。** 

#### 常用命令

```
SADD：添加到集合中
> SADD name value1
(integer) 1
> SADD name value2
(integer) 1

SREM：从集合中移除
> SREM name value1
(integer) 1

SISMEMBER：测试某值是否在集合中，类似于contain，key不存在或者值不在集合中返回0
> SISMEMBER name value1
(integer) 0

SMEMBERS：获取sets中所有的成员，单次响应中返回整个集合
> SMEMBERS name
1) "value1"
2) "value2"
迭代检索集合的所有成员可以考虑使用SSCAN，使用游标形式遍历

SCARD：返回集合大小
> SCARD name
(integer) 1
```

### hash（哈希）

键值对结构数据类型，类似于Java的HashMap。

#### 常用命令

```
HSET：设置hash的字段值，如存在则覆盖
> HSET hashName key1 value1 key2 value2

HGET：获取字段值
> HGET hashName key1
"value1"

HGETALL：返回存储在哈希的所有字段和值 key
> HGETALL hashName
```

### sortedset（排序集合）

Redis 排序集是由相关分数排序的唯一字符串（成员）的集合。 当多个字符串具有相同的分数时，这些字符串按字典顺序排列。 

#### 常用命令

```
> ZADD name 100 value
(integer) 1
```

其中的`100`为分数，故常用于排行榜、滑动窗口速率限制器等用途。

```
ZRANK：获取成员的排名，按照分数从低到高排序，排名从0开始
> ZADD name 1 "value1"
> ZADD name 2 "value2"
> ZADD name 3 "value3"
> ZRANK name "value3"
(integer) 2

ZREVRANK：获取成员的排名，按照分数从高到低排序，排名从0开始
```



还有其他暂时还没了解的Stream流、位图等...

## 持久化

 Redis 本身提供了以下持久化选项：

-  **RDB**(Redis数据库)

  以指定的时间间隔执行数据集的时间点快照，所以在Redis没有正确关闭情况下停止工作，可能会丢失这段间隔时间的数据。

- **AOF**(Append Only File)

  AOF持久化记录接收到的每个写操作会将其附加到 AOF，会将其附加到 AOF在服务器启动时重放，重建原始数据集，日志太大时能够被重写。

  可以在配置文件中打开 AOF： 

  ```
  appendonly yes
  ```

- **No persistence**

  完全禁用持久性，数据仅在服务器运行时存在。

- **RDB + AOF**

  可以在同一实例中结合使用AOF和RDB，当Redis重启启动时，将会使用AOF文件重建原始数据集，因为相比RDB是最完整的。



## 实现分布式锁的脚本

Redis中提供了可编程的接口可以执行自定义脚本。在Redis版本<=6.2，使用LUA脚本 + `EVAL`命令进行编程。

Redis7以及更高版本提供了`Redis functions`。

这里在网上找到了一篇[文章](https://blog.csdn.net/zjcjava/article/details/84842115)中有分布式锁的LUA脚本命令实现，使用的是Redis的`EVAL`命令和LUA脚本。

```lua
-- 设置一个锁
-- 传入key、线程标志（用于判断是否为同一线程）、锁过期释放毫秒数
-- 如果获取锁成功，则返回 1
local key     = KEYS[1]		-- 锁的key
local content = ARGV[1]		-- 锁内容，用于释放
local ttl     = tonumber(ARGV[2])	-- 锁的过期释放时间，单位毫秒
local lockSet = redis.call('setnx', key, content)	-- 前面讲过，如果不存在则设置，成功设置返回1
if lockSet == 1 then	-- 如果存储key成功了，设置一个过期时间
  redis.call('PEXPIRE', key, ttl)
else
  -- 如果锁已经存在，判断value是否与存储的content相同，用于决定是否为同一个线程的请求，实现可重入
  local value = redis.call('get', key)
  if(value == content) then
    lockSet = 1;	-- 如果判定为同个线程请求，则重置一次key过期时间
    redis.call('PEXPIRE', key, ttl)
  end
end
return lockSet	-- 获取锁成功返回1,失败返回0
```

还有释放锁，需要注意的是判断解锁请求线程是否来自于设置锁的线程。

存在情况假设业务A执行时间超过锁过期时间，锁因过期被释放，此时其他线程加了同个key的锁且正在执行业务B过程中，上一个业务A执行完了运行解锁方法，从而导致业务B还没执行完锁就被释放掉了。

解锁脚本：

```lua
-- 解锁
local key     = KEYS[1]
local content = ARGV[1]
local value = redis.call('get', key)
if value == content then	-- 需要判断是否为该线程的解锁请求
  return redis.call('del', key)
else
  return 0	-- 失败返回0
end
```

防止被其他线程解锁的情况可以加判断解决，但是业务方法还没执行完就解锁的问题并没有解决。

Redisson的解决方法，WatchDog机制：

在加锁成功后，会注册一个定时任务每隔10s检查该锁是否还处于持有状态，如果还持有则进行默认30s的锁续约操作。

这些操作Redisson封装成了LUA脚本使得这些逻辑执行具有原子性。

**以上操作在单点Redis还行得通**

例如对于Redis  sentinel下在极端情况可能会有问题。

1. 客户端A从master获取到锁。

2. 在master将锁同步到slave节点之前，master挂了。

3. slave节点晋级为master节点。

4. 客户端B从新的master获取到了锁。

   而这个锁的资源在之前被客户端A获取到了。

所以为了解决这个问题又引入了`RedLock`，采用主节点过半机制，即获取锁或者释放锁成功的标志取决于能否在过半的节点上操作成功。

不过没有想法去了解，后面有时间了想起来再了解一下。
