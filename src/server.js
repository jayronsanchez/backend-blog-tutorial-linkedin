import express from "express";
import { db, connectToDb } from "./db.js";
import { ClientSecretCredential } from "@azure/identity";
import { SecretClient } from "@azure/keyvault-secrets";
import dotenv from "dotenv";

dotenv.config();
const app = express();
// parse request body to json
app.use(express.json());

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

// Provide secret name as query param stored in Azure Key Vault
app.get("/api/get-secret", async (req, res) => {
  const secretName = req.query.name; // Example: ?name=my-secret
  try {
    const secret = await client.getSecret(secretName);
    res.json({ value: secret.value });
  } catch (error) {
    console.error("Error retrieving secret:", error);
    res.status(500).send("Error retrieving secret");
  }
});

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
