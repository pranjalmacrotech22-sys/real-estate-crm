'use client';
import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [userProfile, setUserProfile] = useState(null);

  useEffect(() => {
    const getSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      
      if (currentUser) {
        await fetchProfile(currentUser.id);
      } else {
        setLoading(false);
      }
    };

    const fetchProfile = async (userId) => {
      try {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
        if (data) {
          setUserProfile(data);
        }
      } catch (err) {
        console.error('Failed to fetch profile', err);
      } finally {
        setLoading(false);
      }
    };

    getSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        setLoading(true);
        try {
          const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
          if (data) setUserProfile(data);
        } finally {
          setLoading(false);
        }
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Send OTP to email
  const sendOtp = async (email) => {
    const { data, error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true, // auto sign-up if new user
      },
    });
    if (error) throw error;
    return data;
  };

  // Verify OTP code
  const verifyOtp = async (email, token) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    if (error) throw error;
    return data;
  };

  // Sign in with password
  const signInWithPassword = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, userProfile, loading, sendOtp, verifyOtp, signInWithPassword, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
