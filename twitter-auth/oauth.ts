// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0

import { Client, auth } from "twitter-api-sdk";
import express from "express";
import dotenv from "dotenv";

const accessToken = 'UkxzX3p6a0l4eXNWZV9SYTlxVTc6MTpjaQ'
const secretToken = 'U9xGsCLBwn2giwQiPWDcQnPbhpMjGoNRoFBvaV8-BMlNdv7XdF'
dotenv.config();

const app = express();

const authClient = new auth.OAuth2User({
  client_id: accessToken,
  client_secret: secretToken,
  callback: "http://127.0.0.1:3000/callback",
  scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
});

const client = new Client(authClient);

const STATE = "my-state";

app.get("/callback", async function (req, res) {
  try {
    const { code, state } = req.query;
    if (state !== STATE) return res.status(500).send("State isn't matching");
    const token = await authClient.requestAccessToken(code as string);
    console.log(token.token)
    await
    res.send(token)
  } catch (error) {
    console.log(error);
  }
});

app.get("/login", async function (req, res) {
  const authUrl = authClient.generateAuthURL({
    state: STATE,
    code_challenge_method: "s256",
  });
  res.redirect(authUrl);
});

app.listen(3000, () => {
  console.log(`Go here to login: http://127.0.0.1:3000/login`);
});