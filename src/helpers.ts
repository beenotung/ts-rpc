import { RPCClient } from './base';
import { HttpRPCClient } from './http';
import { NetRPCClient } from './net';
import { WebsocketRPCClient } from './websocket';

export let B = 1;
export let KB = B * 1024;
export let MB = KB * 1024;

export let SECOND = 1000;
export let MINUTE = SECOND * 60;

export let MaxRequestSize = 8 * MB;

export type Addr = {
  host: string;
  tcp?: number;
  ws?: number;
  http?: number;
};

const tag = '[tag]';

export async function startRPCClient(info: Addr): Promise<RPCClient> {
  const { host, tcp, ws, http } = info;
  if (tcp) {
    const client = new NetRPCClient();
    const address = `tcp://${host}:${tcp}`;
    await client.init(address);
    return client;
  }
  if (ws) {
    const client = new WebsocketRPCClient();
    const address = `ws://${host}:${ws}`;
    await client.init(address);
    return client;
  }
  if (http) {
    const client = new HttpRPCClient();
    const address = `http://${host}:${http}`;
    await client.init(address);
    return client;
  }
  console.error(tag, 'unsupported peer type:', info);
  throw new Error('unsupported peer type');
}
