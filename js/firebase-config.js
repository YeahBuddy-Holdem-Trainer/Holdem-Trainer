/* Firebase settings for this app.
   Paste the values from Firebase console > Project settings > Your apps > Web app > SDK setup and configuration.
   These values are not secret: they only say which Firebase project to talk to. What protects each person's
   data is the security rules in firestore.rules, which let a signed-in person read and write only their own data. */
export const firebaseConfig = {
  apiKey: "PASTE_API_KEY",
  authDomain: "PASTE_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_PROJECT_ID",
  storageBucket: "PASTE_PROJECT_ID.firebasestorage.app",
  messagingSenderId: "PASTE_SENDER_ID",
  appId: "PASTE_APP_ID"
};
