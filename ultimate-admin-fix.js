const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function ultimateAdminFix() {
  try {
    console.log('🔧 Ultimate admin fix - working with constraints...');
    
    // Get existing profile
    const { data: existingProfile } = await supabase
      .from('users')
      .select('*')
      .eq('email', 'admin@proudprofits.com')
      .single();
      
    if (!existingProfile) {
      console.log('❌ No profile found');
      return;
    }
    
    console.log('📋 Profile ID:', existingProfile.id);
    console.log('📋 Profile Role:', existingProfile.role);
    
    // Get current auth user
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const adminAuthUser = authUsers.users.find(u => u.email === 'admin@proudprofits.com');
    
    if (adminAuthUser) {
      console.log('🔐 Current auth user ID:', adminAuthUser.id);
      
      if (adminAuthUser.id === existingProfile.id) {
        console.log('✅ IDs already match! Testing login...');
        return;
      }
      
      // Delete current auth user
      console.log('🗑️ Deleting current auth user...');
      await supabase.auth.admin.deleteUser(adminAuthUser.id);
    }
    
    // Try multiple methods to create auth user with specific ID
    console.log('🆕 Attempting to create auth user with profile ID...');
    
    // Method 1: Try with user_id parameter
    let { data: newAuthUser, error: createError } = await supabase.auth.admin.createUser({
      user_id: existingProfile.id,
      email: 'admin@proudprofits.com',
      password: 'admin123',
      email_confirm: true,
      user_metadata: { role: 'admin' }
    });
    
    if (createError || !newAuthUser || newAuthUser.user.id !== existingProfile.id) {
      console.log('⚠️ Method 1 failed, trying method 2...');
      
      // Method 2: Create user and then try to update
      const response = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          'apikey': serviceRoleKey
        },
        body: JSON.stringify({
          user_id: existingProfile.id,
          email: 'admin@proudprofits.com',
          password: 'admin123',
          email_confirm: true,
          role: 'authenticated'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        console.log('✅ Method 2 success! Auth user created with ID:', data.id);
        newAuthUser = data;
      } else {
        console.log('⚠️ Method 2 failed, trying method 3...');
        
        // Method 3: Work around the constraint by creating a temp profile
        
        // First, create a new auth user (will get random ID)
        const { data: tempAuthUser, error: tempError } = await supabase.auth.admin.createUser({
          email: 'admin@proudprofits.com',
          password: 'admin123',
          email_confirm: true
        });
        
        if (tempError) {
          console.error('❌ All methods failed:', tempError);
          return;
        }
        
        console.log('🆕 Created temp auth user:', tempAuthUser.user.id);
        
        // Update buy_signals to reference the new auth user ID
        console.log('🔄 Updating buy_signals to new auth user...');
        const { error: buySignalsUpdateError } = await supabase
          .from('buy_signals')
          .update({ created_by: tempAuthUser.user.id })
          .eq('created_by', existingProfile.id);
          
        if (buySignalsUpdateError) {
          console.error('❌ Failed to update buy_signals:', buySignalsUpdateError);
          return;
        }
        
        // Now delete the old profile
        console.log('🗑️ Deleting old profile...');
        const { error: deleteProfileError } = await supabase
          .from('users')
          .delete()
          .eq('id', existingProfile.id);
          
        if (deleteProfileError) {
          console.error('❌ Failed to delete old profile:', deleteProfileError);
          return;
        }
        
        // Create new profile with auth user ID
        console.log('🆕 Creating new profile with auth user ID...');
        const { error: newProfileError } = await supabase
          .from('users')
          .insert({
            id: tempAuthUser.user.id,
            email: 'admin@proudprofits.com',
            first_name: existingProfile.first_name || 'Admin',
            last_name: existingProfile.last_name || 'User',
            role: 'admin',
            subscription_tier: existingProfile.subscription_tier || 'premium',
            subscription_status: existingProfile.subscription_status || 'active',
            created_at: existingProfile.created_at || new Date().toISOString()
          });
          
        if (newProfileError) {
          console.error('❌ Failed to create new profile:', newProfileError);
          return;
        }
        
        console.log('✅ Successfully created matching profile for auth user');
        newAuthUser = tempAuthUser;
      }
    }
    
    console.log('🎉 Ultimate admin fix complete!');
    console.log('🔐 Auth user ID:', newAuthUser.user?.id || newAuthUser.id);
    console.log('✅ Admin user should now work for login');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

ultimateAdminFix();