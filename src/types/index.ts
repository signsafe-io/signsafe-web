export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export type ContractStatus =
  | "draft"
  | "pending"
  | "signed"
  | "rejected"
  | "expired";

export interface Contract {
  id: string;
  title: string;
  status: ContractStatus;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Signer {
  id: string;
  contractId: string;
  email: string;
  name: string;
  signedAt: string | null;
}

export interface ApiError {
  code: string;
  message: string;
}
