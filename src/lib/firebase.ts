import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCleh3WiiRPD6skBWp5FPzG3DUogOEQoic",
  authDomain: "dappled-root-gj1d7.firebaseapp.com",
  projectId: "dappled-root-gj1d7",
  storageBucket: "dappled-root-gj1d7.firebasestorage.app",
  messagingSenderId: "325914227062",
  appId: "1:325914227062:web:dab1c89e957e9d2d1b4a57"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
// Use initializeFirestore with experimentalForceLongPolling to bypass WebSocket blocks in sandboxed containers
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
}, "ai-studio-0efe4398-99f4-4f1a-b279-83631367cf2a");

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid || null,
      email: auth.currentUser?.email || null,
      emailVerified: auth.currentUser?.emailVerified || false,
      isAnonymous: auth.currentUser?.isAnonymous || false,
      tenantId: auth.currentUser?.tenantId || null,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}
