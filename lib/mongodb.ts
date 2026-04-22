import { MongoClient } from "mongodb";

if (!process.env.MONGODB_URI) {
  throw new Error('Invalid/Missing environment variable: "MONGODB_URI"');
}

const uri = process.env.MONGODB_URI;

const options = {
  maxPoolSize: 10,
  minPoolSize: 1,
  connectTimeoutMS: 60000,
  socketTimeoutMS: 60000,
};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

if (process.env.NODE_ENV === "development") {
  if (!(global as unknown as { _mongoClientPromise?: Promise<MongoClient> })
    ._mongoClientPromise) {
    client = new MongoClient(uri, options);
    (global as unknown as { _mongoClientPromise: Promise<MongoClient> })
      ._mongoClientPromise = client.connect();
  }
  clientPromise = (global as unknown as { _mongoClientPromise: Promise<MongoClient> })
    ._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;

/** Dedicated Kokobay DB on the shared Atlas cluster (same URI as web-score / MoneyAdvert). */
export const kokobayDbName = process.env.MONGODB_DB ?? "kokobay";
