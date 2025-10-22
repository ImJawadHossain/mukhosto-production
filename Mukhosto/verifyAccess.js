import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.2/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/9.22.2/firebase-firestore.js";

// ✅ Your Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyBqzg9fA14lD_ygNx8CSRiRsnrz1bBNfUw",
  authDomain: "memory-auth-9515c.firebaseapp.com",
  projectId: "memory-auth-9515c",
  storageBucket: "memory-auth-9515c.appspot.com",
  messagingSenderId: "862743577103",
  appId: "1:862743577103:web:11fe02f4c24ef2c9c8197a",
  measurementId: "G-XNT36FMPK6"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "/login.html";
    return;
  }

  const userRef = doc(db, "users", user.uid);
  const userSnap = await getDoc(userRef);

  if (!userSnap.exists()) {
    console.error("User document does not exist.");
    window.location.href = "/login.html";
    return;
  }

  const userData = userSnap.data();

  // ✅ MAIN LOGIC
  if (userData.paymentStatus === "verified") {
    // Payment fully verified, allow access
    console.log("Access granted: Payment verified");
    return;
  } else {
    if (userData.paid === true && user.emailVerified) {
      // Paid is true AND email is verified, allow access
      console.log("Access granted: Paid and email verified");
      return;
    }

    if (userData.paid !== true) {
      // Paid is not true, go to payment page
      window.location.href = "/payment.html";
      return;
    }


  }
});
