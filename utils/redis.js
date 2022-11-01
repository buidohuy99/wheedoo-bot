import redis from 'redis';

// create and connect redis client to local instance.
const client = redis.createClient({
    url: `redis://${process.env.REDIS_USERNAME}:${process.env.REDIS_PASSWORD}@${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`
});

await client.connect();

export default client;

