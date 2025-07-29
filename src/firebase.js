// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDHCtwBnDhUrksjZwd9o1vDNGdvZB24rPs",
  authDomain: "wb-airtelmscs.firebaseapp.com",
  projectId: "wb-airtelmscs",
  storageBucket: "wb-airtelmscs.firebasestorage.app",
  messagingSenderId: "747029201509",
  appId: "1:747029201509:web:980d35fa5dc71e13927c8c",
  measurementId: "G-EHXZPP9592"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };