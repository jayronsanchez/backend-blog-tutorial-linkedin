import { MongoClient } from "mongodb";

let db;

const connectToDb = async (callBackFnc) => {
  const client = new MongoClient("mongodb://127.0.0.1:27017/");
  await client.connect();
  db = client.db("react-blog-db");
  callBackFnc();
};

export { db, connectToDb };
