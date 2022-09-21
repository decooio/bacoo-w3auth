import * as _ from "lodash";
import {CommonResponse} from "../type/common";
import {hexToU8a, stringToU8a, u8aConcat, u8aToU8a} from "@polkadot/util";
import {signatureVerify} from "@polkadot/util-crypto";
import axios from "axios";
const http = axios.create();
http.defaults.timeout = 5000;
const VALID_CHAIN_TYPES = ['substrate', 'sub'];
const chainTypeDelimiter = '-';
const pkSigDelimiter = ':';
const GATEWAY_ID = process.env.GATEWAY_ID || 1;
const GATEWAY_PASS = process.env.GATEWAY_PASS || '12345';
const API_HOST = process.env.API_HOST || 'http://localhost:3000';

export async function w3auth(req: any, res: any, next: any) {
    if (
        !_.includes(req.headers.authorization, 'Basic ') &&
        !_.includes(req.headers.authorization, 'Bearer ')
    ) {
        CommonResponse.unauthorized('Empty Signature').send(res);
        return;
    }

    try {
        // 2. Decode AuthToken
        const base64Credentials = _.split(
            _.trim(req.headers.authorization),
            ' '
        )[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString(
            'ascii'
        );

        // 3. Parse AuthToken as `ChainType[substrate/eth/solana].PubKey:SignedMsg`
        const [passedAddress, sig] = _.split(credentials, pkSigDelimiter);

        // 4. Extract chain type, default: 'sub' if not specified
        const gaugedAddress = _.includes(passedAddress, chainTypeDelimiter)
            ? passedAddress
            : `sub${chainTypeDelimiter}${passedAddress}`;
        const [chainType, address, txMsg] = _.split(
            gaugedAddress,
            chainTypeDelimiter
        );
        if (_.indexOf(VALID_CHAIN_TYPES, chainType) >= 0 && substrateAuth(address, sig)) {
            req.chainAddress = address;

            return next();
        }
    } catch(e) {
        console.log(`Decode signature failed: ${e.stack}`);
    }
    CommonResponse.unauthorized('Invalid Signature').send(res);
    return;
}

export async function userPlan(req: any, res: any, next: any) {
    const address = req.chainAddress;
    if (_.isString(address)) {
        try {
            await axios.get(`${API_HOST}/gateway/verify/upload/${address}`, {
                headers: {
                    'gateway-id': GATEWAY_ID,
                    'gateway-password': GATEWAY_PASS
                }
            });
            return next();
        } catch (error) {
            if (axios.isAxiosError(error) && !_.isEmpty(error.response)) {
                return res.status(error.response.status).json(error.response.data);
            } else {
                console.log(`query user plan err: ${error.message}`);
                return CommonResponse.serverError('server err').send(res);
            }
        }
    }
    return CommonResponse.unauthorized('Invalid Signature').send(res);
}


function substrateAuth(address: string, signature: string): boolean {
    try {
        const message = stringToU8a(address);

        if (signatureVerify(message, hexToU8a(signature), address).isValid) {
            return true;
        }

        const wrappedMessage = u8aConcat(
            u8aToU8a('<Bytes>'),
            message,
            u8aToU8a('</Bytes>')
        );

        return signatureVerify(wrappedMessage, hexToU8a(signature), address)
            .isValid;
    } catch (error) {
    }
    return false;
}
