// E:\study\techfix\techfix-app\src\context\AuthContext.js
import React, { createContext, useReducer, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';


export const AuthContext = createContext();


export const AuthProvider = ({ children }) => {
  const [state, dispatch] = useReducer(
    (prevState, action) => {
      switch (action.type) {
        case 'RESTORE_TOKEN':
          return {
            ...prevState,
            userToken: action.token,
            role: action.role,
            user: action.user,
            isLoading: false,
          };
        case 'SIGN_IN':
          return {
            ...prevState,
            isSignout: false,
            userToken: action.token,
            role: action.role,
            user: action.user,
          };
        case 'SIGN_OUT':
          return {
            ...prevState,
            isSignout: true,
            userToken: null,
            role: null,
            user: null,
          };
        default:
          return prevState;
      }
    },
    {
      isLoading: true,
      isSignout: false,
      userToken: null,
      role: null,
      user: null,
    }
  );


  useEffect(() => {
    const bootstrapAsync = async () => {
      try {
        const token = await AsyncStorage.getItem('access_token');
        const role = await AsyncStorage.getItem('role');
        const user = await AsyncStorage.getItem('user');


        dispatch({
          type: 'RESTORE_TOKEN',
          token,
          role,
          user: user ? JSON.parse(user) : null,
        });
      } catch (e) {
        console.error('Restore failed:', e);
      }
    };


    bootstrapAsync();
  }, []);


  const signOut = async () => {
    try {
      await AsyncStorage.removeItem('access_token');
      await AsyncStorage.removeItem('refresh_token');
      await AsyncStorage.removeItem('userToken');
      await AsyncStorage.removeItem('role');
      await AsyncStorage.removeItem('user');
    } catch (e) {
      console.error('Logout error:', e);
    }
    dispatch({ type: 'SIGN_OUT' });
  };


  return (
    <AuthContext.Provider value={{ state, dispatch, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};