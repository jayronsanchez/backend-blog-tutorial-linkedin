import fs from "fs";
import admin from "firebase-admin";
import express from "express";
import { db, connectToDb } from "./db.js";
import { ClientSecretCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import dotenv from "dotenv";
dotenv.config();

const credentials = JSON.parse(fs.readFileSync("./credentials.json")); // get credentials from firebase admin service accounts
admin.initializeApp({ credential: admin.credential.cert(credentials) });

// Provide Tenant ID, Client ID and Client Secret of the Registered Application in Azure (Service Principal)
// Make sure that the Registered Application have role assignments (Key Vaults Secret User) in the key vault
const keyVaultName = process.env.KEY_VAULT_NAME;
const url = `https://${keyVaultName}.vault.azure.net`;
const credential = new ClientSecretCredential(
  process.env.AZURE_TENANT_ID,
  process.env.AZURE_CLIENT_ID,
  // client secret expires every 6 months
  process.env.AZURE_CLIENT_SECRET
);
const client = new SecretClient(url, credential);

const app = express();
// parse request body to json
app.use(express.json());

// next is a function that we call (ex: next will process get requests below) when we're done with our middleware
app.use(async (req, res, next) => {
  const { authtoken } = req.headers;
  if (authtoken) {
    try {
      req.user = await admin.auth().verifyIdToken(authtoken);
    } catch (e) {
      return res.sendStatus(400);
    }
  }
  req.user = req.user || {};
  next();
});

// Provide secret name as query param stored in Azure Key Vault
app.get("/api/get-secret", async (req, res) => {
  const secretName = req.query.name; // Example: ?name=my-secret
  try {
    //const secret = await client.getSecret(secretName); // akv access currently forbidden ; subscription expired
    const secret = { value: process.env.FIREBASE_API_KEY };
    res.json({ value: secret.value });
  } catch (error) {
    console.error("Error retrieving secret:", error);
    res.status(500).send("Error retrieving secret");
  }
});

app.get("/api/articles/:name", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;

  const article = await db.collection("articles").findOne({ name });

  if (article) {
    const upvoteIds = article.upvoteIds || [];
    article.canUpvote = uid && !upvoteIds.includes(uid);
    res.json(article);
  } else {
    res.sendStatus(404);
  }
});

// Middleware to check if user is authenticated for upvoting and commenting (see requests below)
app.use((req, res, next) => {
  if (req.user) {
    next();
  } else {
    res.sendStatus(401);
  }
});

app.put("/api/articles/:name/upvote", async (req, res) => {
  const { name } = req.params;
  const { uid } = req.user;

  const article = await db.collection("articles").findOne({ name });

  if (article) {
    const upvoteIds = article.upvoteIds || [];
    const canUpvote = uid && !upvoteIds.includes(uid);
    if (canUpvote) {
      await db.collection("articles").updateOne(
        { name },
        {
          $inc: { upvotes: 1 },
          $push: { upvoteIds: uid },
        }
      ); // $inc - increment a value , $set - set a value, $push - push a value to an array
    }
    const updatedArticle = await db.collection("articles").findOne({ name });
    res.json(updatedArticle);
  } else {
    res.send("That article doesn't exist");
  }
});

app.post("/api/articles/:name/comments", async (req, res) => {
  const { name } = req.params;
  const { text } = req.body;
  const { email } = req.user;

  await db.collection("articles").updateOne(
    { name },
    {
      $push: { comments: { postedBy: email, text } },
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
