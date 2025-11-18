import type * as __compactRuntime from '@midnight-ntwrk/compact-runtime';

export type Witnesses<T> = {
}

export type ImpureCircuits<T> = {
  issueCredential(context: __compactRuntime.CircuitContext<T>,
                  agentSecret_0: string): __compactRuntime.CircuitResults<T, []>;
  proveAuthorization(context: __compactRuntime.CircuitContext<T>,
                     agentSecret_0: string,
                     expectedCommitment_0: string): __compactRuntime.CircuitResults<T, []>;
  reportBlocked(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, []>;
}

export type PureCircuits = {
}

export type Circuits<T> = {
  issueCredential(context: __compactRuntime.CircuitContext<T>,
                  agentSecret_0: string): __compactRuntime.CircuitResults<T, []>;
  proveAuthorization(context: __compactRuntime.CircuitContext<T>,
                     agentSecret_0: string,
                     expectedCommitment_0: string): __compactRuntime.CircuitResults<T, []>;
  reportBlocked(context: __compactRuntime.CircuitContext<T>): __compactRuntime.CircuitResults<T, []>;
}

export type Ledger = {
  readonly totalCredentials: bigint;
  readonly successfulAuth: bigint;
  readonly blockedAttempts: bigint;
  readonly lastCredentialCommitment: string;
}

export type ContractReferenceLocations = any;

export declare const contractReferenceLocations : ContractReferenceLocations;

export declare class Contract<T, W extends Witnesses<T> = Witnesses<T>> {
  witnesses: W;
  circuits: Circuits<T>;
  impureCircuits: ImpureCircuits<T>;
  constructor(witnesses: W);
  initialState(context: __compactRuntime.ConstructorContext<T>): __compactRuntime.ConstructorResult<T>;
}

export declare function ledger(state: __compactRuntime.StateValue): Ledger;
export declare const pureCircuits: PureCircuits;
