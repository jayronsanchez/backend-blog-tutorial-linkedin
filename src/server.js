import express from "express";
import { db, connectToDb } from "./db.js";

const app = express();
// parse request body to json
app.use(express.json());

app.get("/api/articles/:name", async (req, res) => {
  const { name } = req.params;

  const article = await db.collection("articles").findOne({ name });

  if (article) {
    res.json(article);
  } else {
    res.sendStatus(404);
  }
});

app.put("/api/articles/:name/upvote", async (req, res) => {
  const { name } = req.params;

  await db.collection("articles").updateOne({ name }, { $inc: { upvotes: 1 } }); // $inc - increment a value , $set - set a value

  const article = await db.collection("articles").findOne({ name });
  if (article) {
    //res.send(`The ${name} article now has ${article.upvotes} upvotes`);
    res.json(article);
  } else {
    res.send("That article doesn't exist");
  }
});

app.post("/api/articles/:name/comments", async (req, res) => {
  const { name } = req.params;
  const { postedBy, text } = req.body;

  await db.collection("articles").updateOne(
    { name },
    {
      $push: { comments: { postedBy, text } },
    }
  );

  const article = await db.collection("articles").findOne({ name });
  if (article) {
    //res.send(article.comments);
    res.json(article);
  } else {
    res.send("That article doesn't exist");
  }
});

connectToDb(() => {
  console.log("Successfully connected to database");
  // application should connect to DB first so we pass this as a callback function
  app.listen(8000, () => {
    console.log("Server is listening on port 8000");
  });
});
