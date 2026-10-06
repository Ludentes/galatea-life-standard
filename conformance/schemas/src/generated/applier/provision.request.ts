/* Generated from conformance/schemas/applier/provision.request.json by scripts/gen-types.ts. Do not edit. */

export type ApplierProvisionRequest = {
  idempotency_key?: string;
  join?: {
    transport: string;
    window_s: number;
    near?: string;
  };
  join_close?: {
    transport: string;
  };
  commission?: {
    transport: string;
    code: string;
    accept_unattested?: boolean;
  };
  connect?: {
    candidate: string;
    bridge: string;
    address?: unknown;
  };
  remove?: {
    [k: string]: unknown | undefined;
  } & {
    device?: string;
    identifier?: string;
    bridge?: string;
    block_rejoin: boolean;
    force?: boolean;
  };
  unblock?: {
    identifier: string;
    bridge: string;
  };
  install?: {
    host: string;
    account: string;
    package: {
      url: string;
      sha256: string;
    };
  };
  uninstall?: {
    host: string;
    plugin: string;
  };
} & {
  [k: string]: unknown | undefined;
};
