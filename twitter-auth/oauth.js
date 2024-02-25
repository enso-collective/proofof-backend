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
const accessToken = 'YWxWU1AybEdFejdZU2F1V2pBSno6MTpjaQ';
const secretToken = '2uKYfKIZV-8bGreqrLhm5IJ8IcoVh-ItyXpRodq27XKNL4zVd_';
dotenv_1.default.config();
const app = (0, express_1.default)();
const authClient = new twitter_api_sdk_1.auth.OAuth2User({
    client_id: accessToken,
    client_secret: secretToken,
    callback: "http://127.0.0.1:3000/callback",
    scopes: ["tweet.read", "tweet.write", "users.read", "offline.access"],
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
            yield res.send(token);
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
app.listen(3000, () => {
    console.log(`Go here to login: http://127.0.0.1:3000/login`);
});
