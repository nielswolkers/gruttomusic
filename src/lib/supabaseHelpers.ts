import { supabase } from "@/integrations/supabase/client";

export const authHelpers = {
  async signUp(email: string, password: string, username: string, displayName?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          display_name: displayName,
        },
        emailRedirectTo: `${window.location.origin}/`,
      },
    });
    return { data, error };
  },

  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  },

  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  },

  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    return { session: data.session, error };
  },
};

export const fileHelpers = {
  async uploadFile(file: File, userId: string) {
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/${Date.now()}_${file.name}`;

    const { data, error } = await supabase.storage
      .from('user-files')
      .upload(fileName, file);

    if (error) return { data: null, error };

    const { data: { publicUrl } } = supabase.storage
      .from('user-files')
      .getPublicUrl(fileName);

    return { data: { ...data, publicUrl, fileName }, error: null };
  },

  async deleteFile(filePath: string) {
    const { error } = await supabase.storage
      .from('user-files')
      .remove([filePath]);
    return { error };
  },

  async getFileUrl(filePath: string) {
    const { data } = supabase.storage
      .from('user-files')
      .getPublicUrl(filePath);
    return data.publicUrl;
  },
};
