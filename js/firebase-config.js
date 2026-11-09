/* Firebase settings for this app.
   Paste the values from Firebase console > Project settings > Your apps > Web app > SDK setup and configuration.
   These values are not secret: they only say which Firebase project to talk to. What protects each person's
   data is the security rules in firestore.rules, which let a signed-in person read and write only their own data. */
export const firebaseConfig = {
  apiKey: "AIzaSyC-n0x6fx4hdY6QivuKceuGSsJtDYacWPM",
  authDomain: "holdemtrainer.firebaseapp.com",
  projectId: "holdemtrainer",
  storageBucket: "holdemtrainer.firebasestorage.app",
  messagingSenderId: "314607088027",
  appId: "1:314607088027:web:62a4e9dbfe0fafefe1b13e"
};
