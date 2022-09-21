/* eslint-disable node/no-extraneous-import */
import {userPlan, w3auth} from "./middleware/w3auth";
require('dotenv').config();
import {IncomingMessage, ServerResponse} from "http";
const express = require('express');
const cors = require('cors');
const { createProxyMiddleware, responseInterceptor } = require('http-proxy-middleware');
const target = process.env.IPFS_ENDPOINT || 'http://127.0.0.1:5001';
const server = express();
const requestTimeout = 40 * 60 * 1000;
server.use(cors());
server.use(w3auth);
server.use(userPlan);
server.all('*', createProxyMiddleware({ target, selfHandleResponse: true, proxyTimeout: 60 * 1000 * 30, timeout: 60 * 1000 * 30,  onProxyRes: responseInterceptor(async (responseBuffer: Buffer, proxyRes: IncomingMessage, req: IncomingMessage, res: ServerResponse) => {
  res.removeHeader('Trailer');
  return responseBuffer;
})}));

const port = process.env.PORT || 5050;
console.log(`Listening on port ${port}`);
const httpServer = server.listen(port);
httpServer.requestTimeout = requestTimeout;
