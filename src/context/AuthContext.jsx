import React, { createContext, useState, useEffect, useContext } from 'react';
import { onAuthStateChanged } from "firebase/auth";
import { ref, get } from "firebase/database";
import { auth, database } from '../firebase/firebaseConfig';

const AuthContext = createContext();

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        const userDbRef = ref(database, 'users/' + user.uid);
        try {
          const userSnapshot = await get(userDbRef);
          if (userSnapshot.exists()) {
            const dbUserData = userSnapshot.val();
            let storeName = null;
            if (dbUserData.storeId) {
              const storeRef = ref(database, `stores/${dbUserData.storeId}/name`);
              const storeSnapshot = await get(storeRef);
              if (storeSnapshot.exists()) {
                storeName = storeSnapshot.val();
              } else {
                 console.warn(`Store name not found for storeId: ${dbUserData.storeId}`);
              }
            } else {
                 console.warn(`User ${user.email} does not have a storeId assigned.`);
            }
            setUserData({
                email: user.email,
                role: dbUserData.role || null,
                storeId: dbUserData.storeId || null,
                storeName: storeName
            });

          } else {
            console.warn(`No data found in /users/${user.uid} for the logged-in user.`);
             setUserData({ email: user.email, role: null, storeId: null, storeName: null });
          }
        } catch (error) {
          console.error("Error fetching user data from DB:", error);
           setUserData({ email: user.email, role: null, storeId: null, storeName: null });
        }
      } else {
         setUserData(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const value = {
    currentUser,
    userData,
    userRole: userData?.role || null,
    userStoreId: userData?.storeId || null,
    userStoreName: userData?.storeName || null,
    loading
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}