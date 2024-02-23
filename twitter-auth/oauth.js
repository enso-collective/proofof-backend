"use strict";
// Copyright 2021 Twitter, Inc.
// SPDX-License-Identifier: Apache-2.0
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const twitter_api_sdk_1 = require("twitter-api-sdk");
const express_1 = __importDefault(require("express"));
const dotenv_1 = __importDefault(require("dotenv"));
const accessToken = 'ZUlCbkxoajBSMGN6dXUwd252VFc6MTpjaQ';
const secretToken = 'T7lInlY4NWYXdKfePvPnbFm_CYyp0au5iwkK353yN6uTFj2a-n';
dotenv_1.default.config();
const app = (0, express_1.default)();
const authClient = new twitter_api_sdk_1.auth.OAuth2User({
    client_id: accessToken,
    client_secret: secretToken,
    callback: "http://127.0.0.1:3000/callback",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
    token: {
        token_type: 'bearer',
        access_token: 'T0JzdWlRamJTVnVoZGlHRGQyS2ZGZ01JVkVtQ3BDQmFsNUtoa1lhV2ZZLUNPOjE3MDg2Nzc4Nzk3NDM6MToxOmF0OjE',
        scope: 'tweet.write users.read tweet.read offline.access',
        refresh_token: 'UU9zeXYyODVzMXVZU1ozS3dkeDZiX2tvdFpWbkJOS3pPV1hoNGRsc2VHdENvOjE3MDg2Nzc4Nzk3NDM6MTowOnJ0OjE',
        expires_at: 1708685079737
    }
});
const client = new twitter_api_sdk_1.Client(authClient);
const STATE = "my-state";
app.get("/callback", function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const { code, state } = req.query;
            if (state !== STATE)
                return res.status(500).send("State isn't matching");
            const token = yield authClient.requestAccessToken(code);
            console.log(token.token);
            yield res.redirect("/tweets");
        }
        catch (error) {
            console.log(error);
        }
    });
});
app.get("/login", function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        const authUrl = authClient.generateAuthURL({
            state: STATE,
            code_challenge_method: "s256",
        });
        res.redirect(authUrl);
    });
});
app.get("/tweets", function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const tweets = yield client.tweets.findTweetById("20");
            res.send(tweets);
            yield client.tweets.createTweet({ text: "test" });
        }
        catch (error) {
            console.log("tweets error", error);
        }
    });
});
app.get("/revoke", function (req, res) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield authClient.revokeAccessToken();
            res.send(response);
        }
        catch (error) {
            console.log(error);
        }
    });
});
app.listen(3000, () => {
    console.log(`Go here to login: http://127.0.0.1:3000/login`);
});
