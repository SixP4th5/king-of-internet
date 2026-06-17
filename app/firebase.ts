import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBy3GVWOTA7d1-sIL7AJfxHjPQ6k33OMiU",
  authDomain: "king-of-internet.firebaseapp.com",
  projectId: "king-of-internet",
  storageBucket: "king-of-internet.firebasestorage.app",
  messagingSenderId: "525067053168",
  appId: "1:525067053168:web:0e985d26fd5cd840c46cb5",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);