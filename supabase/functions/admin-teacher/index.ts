import { createClient } from '@supabase/supabase-js';

const cors={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, x-client-info, apikey, content-type','Access-Control-Allow-Methods':'POST, OPTIONS'};
const encoder=new TextEncoder();
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...cors,'Content-Type':'application/json','Cache-Control':'no-store'}});
const hex=(value:ArrayBuffer)=>[...new Uint8Array(value)].map(x=>x.toString(16).padStart(2,'0')).join('');
const cleanUsername=(value:unknown)=>String(value??'').trim().toLowerCase().replace(/[^a-z0-9._-]/g,'');
const cleanEmail=(value:unknown)=>String(value??'').trim().toLowerCase();
const validEmail=(value:string)=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
async function hashPin(pin:string,salt:string){const key=await crypto.subtle.importKey('raw',encoder.encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:210000,hash:'SHA-256'},key,256);return hex(bits)}
function randomInternalPassword(){const bytes=crypto.getRandomValues(new Uint8Array(32));return [...bytes].map(x=>x.toString(16).padStart(2,'0')).join('')+'Aa1!'}
const DELEGATED_ACTIONS=new Set(['capabilities','create','set_teacher_pin']);

Deno.serve(async request=>{
  if(request.method==='OPTIONS')return new Response('ok',{headers:cors});
  const correlationId=crypto.randomUUID();
  if(request.method!=='POST')return json({error:'Invalid request',correlation_id:correlationId},405);
  try{
    const url=Deno.env.get('SUPABASE_URL')!;
    const publishable=JSON.parse(Deno.env.get('SUPABASE_PUBLISHABLE_KEYS')||'{}').default||Deno.env.get('SUPABASE_ANON_KEY')!;
    const secret=JSON.parse(Deno.env.get('SUPABASE_SECRET_KEYS')||'{}').default||Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authorization=request.headers.get('Authorization')||'';
    const userClient=createClient(url,publishable,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const admin=createClient(url,secret,{auth:{persistSession:false,autoRefreshToken:false}});
    const authenticated=await userClient.auth.getUser();
    if(!authenticated.data.user)return json({error:'Unauthorized',correlation_id:correlationId},401);
    const userId=authenticated.data.user.id;
    const {data:profile}=await admin.from('profiles').select('role,account_state').eq('id',userId).maybeSingle();
    if(!profile||profile.account_state==='disabled')return json({error:'Forbidden',correlation_id:correlationId},403);
    const {data:owner}=await admin.from('super_admin_owner').select('user_id').eq('singleton',true).maybeSingle();
    const isOwner=owner?.user_id===userId;
    const body=await request.json().catch(()=>({}));
    const action=String(body.action||'');
    const isAppAdmin=profile.role==='admin';
    // V47 — délégation : administrateur d'un espace ou permission « accounts.manage » dans cet espace.
    let delegatedSpaces:string[]=[];
    if(!isAppAdmin){
      const [{data:adm},{data:perm}]=await Promise.all([
        admin.from('space_members').select('space_id').eq('profile_id',userId).eq('role','admin'),
        admin.from('space_permissions').select('space_id').eq('profile_id',userId).eq('perm','accounts.manage')]);
      delegatedSpaces=[...new Set([...(adm||[]),...(perm||[])].map((r:{space_id:string})=>r.space_id))];
      if(!delegatedSpaces.length||!DELEGATED_ACTIONS.has(action))return json({error:'Forbidden',correlation_id:correlationId},403);
    }
    const audit=async(entityType:string,entityId:string|null,afterState:unknown,justification?:string)=>{await admin.from('audit_logs').insert({actor_id:userId,action:`admin.${action}`,entity_type:entityType,entity_id:entityId,correlation_id:correlationId,after_state:afterState,justification:justification||null})};

    if(action==='capabilities')return json({ok:true,can_manage_admin_roles:isOwner,delegated_spaces:delegatedSpaces,correlation_id:correlationId});

    if(action==='set_admin_pin'){
      const pin=String(body.pin||'');
      if(!/^\d{6,12}$/.test(pin))return json({error:'Invalid PIN',correlation_id:correlationId},400);
      const salt=crypto.randomUUID()+crypto.randomUUID();
      const result=await admin.from('admin_pin_credentials').upsert({user_id:userId,salt,pin_hash:await hashPin(pin,salt),updated_at:new Date().toISOString()});
      if(result.error)return json({error:'Operation failed',correlation_id:correlationId},400);
      await audit('profile',userId,{pin_changed:true});
      return json({ok:true,correlation_id:correlationId});
    }

    if(action==='create'){
      const username=cleanUsername(body.username);
      const pin=String(body.pin||'');
      const fullName=String(body.full_name||'').trim();
      const requestedEmail=cleanEmail(body.email);
      const spaceId=String(body.space_id||'');
      if(!isAppAdmin&&!delegatedSpaces.includes(spaceId))return json({error:'Forbidden',code:'SPACE_NOT_MANAGED',correlation_id:correlationId},403);
      if(!username||!fullName||!/^\d{6}$/.test(pin))return json({error:'Invalid teacher data',correlation_id:correlationId},400);
      if(requestedEmail&&!validEmail(requestedEmail))return json({error:'Invalid email',correlation_id:correlationId},400);
      const {data:usernameMatch}=await admin.from('profiles').select('id').ilike('username',username).limit(1);
      if(usernameMatch?.length)return json({error:'Username already used',code:'USERNAME_TAKEN',correlation_id:correlationId},409);
      if(requestedEmail){const {data:emailMatch}=await admin.from('profiles').select('id').ilike('email',requestedEmail).limit(1);if(emailMatch?.length)return json({error:'Email already used',code:'EMAIL_TAKEN',correlation_id:correlationId},409);}
      const authEmail=`${username}@presence-app.local`;
      const profileEmail=requestedEmail||authEmail;
      const internalPassword=randomInternalPassword();
      const created=await admin.auth.admin.createUser({email:authEmail,password:internalPassword,email_confirm:true,user_metadata:{full_name:fullName,username},app_metadata:{role:'teacher'}});
      if(created.error||!created.data.user)return json({error:'Account creation failed',correlation_id:correlationId},400);
      const targetId=created.data.user.id;
      const profileWrite=await admin.from('profiles').upsert({id:targetId,full_name:fullName,role:'teacher',email:profileEmail,username,mfa_required:false,account_state:'active'});
      if(profileWrite.error){await admin.auth.admin.deleteUser(targetId);return json({error:'Account creation failed',correlation_id:correlationId},400)}
      const salt=crypto.randomUUID()+crypto.randomUUID();
      const pinWrite=await admin.from('admin_pin_credentials').upsert({user_id:targetId,salt,pin_hash:await hashPin(pin,salt),updated_at:new Date().toISOString()});
      if(pinWrite.error){await admin.auth.admin.deleteUser(targetId);return json({error:'PIN creation failed',correlation_id:correlationId},400)}
      // Le nouvel enseignant rejoint l'espace demandé (obligatoire pour une création déléguée).
      if(spaceId){
        const member=await admin.from('space_members').upsert({space_id:spaceId,profile_id:targetId,role:'teacher'},{onConflict:'space_id,profile_id'});
        if(member.error&&!isAppAdmin){await admin.auth.admin.deleteUser(targetId);return json({error:'Account creation failed',correlation_id:correlationId},400)}
        await admin.from('v33_s2_audit').insert({space_id:spaceId,action:'set_member',actor:userId,detail:{profile:targetId,role:'teacher',before:null,created_account:true}});
      }
      await audit('profile',targetId,{username,email:profileEmail,role:'teacher',pin_configured:true,space_id:spaceId||null,delegated:!isAppAdmin});
      return json({ok:true,id:targetId,username,email:profileEmail,correlation_id:correlationId});
    }

    if(action==='update_profile'){
      const targetId=String(body.user_id||'');
      const fullName=String(body.full_name||'').trim();
      const username=cleanUsername(body.username);
      const email=cleanEmail(body.email);
      if(!targetId||!fullName||!username||!validEmail(email))return json({error:'Invalid profile data',correlation_id:correlationId},400);
      const {data:target}=await admin.from('profiles').select('id,role,full_name,username,email,account_state').eq('id',targetId).maybeSingle();
      if(!target)return json({error:'Account not found',correlation_id:correlationId},404);
      const {data:usernameMatch}=await admin.from('profiles').select('id').ilike('username',username).neq('id',targetId).limit(1);
      if(usernameMatch?.length)return json({error:'Username already used',code:'USERNAME_TAKEN',correlation_id:correlationId},409);
      const {data:emailMatch}=await admin.from('profiles').select('id').ilike('email',email).neq('id',targetId).limit(1);
      if(emailMatch?.length)return json({error:'Email already used',code:'EMAIL_TAKEN',correlation_id:correlationId},409);
      const updatedAt=new Date().toISOString();
      const profileWrite=await admin.from('profiles').update({full_name:fullName,username,email,updated_at:updatedAt}).eq('id',targetId);
      if(profileWrite.error)return json({error:'Profile update failed',correlation_id:correlationId},400);
      const authWrite=await admin.auth.admin.updateUserById(targetId,{user_metadata:{full_name:fullName,username}});
      if(authWrite.error){
        await admin.from('profiles').update({full_name:target.full_name,username:target.username,email:target.email,updated_at:updatedAt}).eq('id',targetId);
        return json({error:'Profile update failed',correlation_id:correlationId},400);
      }
      await audit('profile',targetId,{full_name:fullName,username,email,account_state:target.account_state});
      return json({ok:true,id:targetId,full_name:fullName,username,email,correlation_id:correlationId});
    }

    if(action==='set_account_state'){
      const targetId=String(body.user_id||'');
      const accountState=String(body.account_state||'');
      if(!targetId||!['active','disabled'].includes(accountState))return json({error:'Invalid account state',correlation_id:correlationId},400);
      if(targetId===userId&&accountState==='disabled')return json({error:'Cannot disable current admin',correlation_id:correlationId},400);
      if(owner?.user_id===targetId&&accountState==='disabled')return json({error:'Cannot disable owner',correlation_id:correlationId},403);
      const {data:target}=await admin.from('profiles').select('id,role,account_state').eq('id',targetId).maybeSingle();
      if(!target)return json({error:'Account not found',correlation_id:correlationId},404);
      if(accountState==='disabled'){
        const {count}=await admin.from('v21_teacher_day_manipulations').select('teacher_id',{count:'exact',head:true}).eq('teacher_id',targetId).eq('active',true);
        if((count||0)>0)return json({error:'Remove teacher from V21 intervention configuration before disabling the account',code:'TEACHER_CONFIGURED',correlation_id:correlationId},409);
      }
      const result=await admin.from('profiles').update({account_state:accountState,updated_at:new Date().toISOString()}).eq('id',targetId);
      if(result.error)return json({error:'Operation failed',correlation_id:correlationId},400);
      await audit('profile',targetId,{account_state:accountState},String(body.justification||''));
      return json({ok:true,account_state:accountState,correlation_id:correlationId});
    }

    if(action==='set_teacher_pin'){
      const targetId=String(body.user_id||'');
      const pin=String(body.pin||'');
      if(!targetId||!/^\d{6}$/.test(pin))return json({error:'Invalid teacher PIN',correlation_id:correlationId},400);
      const {data:target}=await admin.from('profiles').select('id,role,account_state').eq('id',targetId).maybeSingle();
      if(!target)return json({error:'Account not found',correlation_id:correlationId},404);
      if(!isAppAdmin){
        // Délégation : seulement un enseignant (jamais un administrateur ni le super administrateur) membre d'un espace géré.
        if(target.role==='admin'||owner?.user_id===targetId||targetId===userId)return json({error:'Forbidden',correlation_id:correlationId},403);
        const {data:mem}=await admin.from('space_members').select('space_id,role').eq('profile_id',targetId).in('space_id',delegatedSpaces);
        if(!(mem||[]).some((m:{role:string})=>m.role==='teacher'))return json({error:'Forbidden',code:'NOT_IN_MANAGED_SPACE',correlation_id:correlationId},403);
      }
      const salt=crypto.randomUUID()+crypto.randomUUID();
      const result=await admin.from('admin_pin_credentials').upsert({user_id:targetId,salt,pin_hash:await hashPin(pin,salt),updated_at:new Date().toISOString()});
      if(result.error)return json({error:'Operation failed',correlation_id:correlationId},400);
      await audit('profile',targetId,{teacher_pin_reset:true,delegated:!isAppAdmin},String(body.justification||''));
      return json({ok:true,correlation_id:correlationId});
    }

    if(action==='set_admin_role'){
      if(!isOwner)return json({error:'Forbidden',correlation_id:correlationId},403);
      const targetId=String(body.user_id||'');const makeAdmin=body.is_admin===true;
      if(!targetId||targetId===userId)return json({error:'Invalid role target',correlation_id:correlationId},400);
      const target=await admin.from('profiles').select('id,role').eq('id',targetId).maybeSingle();
      if(!target.data)return json({error:'Account not found',correlation_id:correlationId},404);
      const role=makeAdmin?'admin':'teacher';
      const pu=await admin.from('profiles').update({role,updated_at:new Date().toISOString()}).eq('id',targetId);
      if(pu.error)return json({error:'Operation failed',correlation_id:correlationId},400);
      const au=await admin.auth.admin.updateUserById(targetId,{app_metadata:{role}});
      if(au.error){await admin.from('profiles').update({role:target.data.role}).eq('id',targetId);return json({error:'Operation failed',correlation_id:correlationId},400)}
      await audit('profile',targetId,{role});
      return json({ok:true,role,correlation_id:correlationId});
    }

    if(action==='reset_password'){
      const targetId=String(body.user_id||'');const password=String(body.password||'');
      if(!targetId||password.length<6||password.length>128)return json({error:'Invalid reset data',correlation_id:correlationId},400);
      const target=await admin.from('profiles').select('role').eq('id',targetId).maybeSingle();
      if(target.data?.role==='teacher')return json({error:'Teacher password login disabled',correlation_id:correlationId},400);
      if(owner?.user_id===targetId&&!isOwner)return json({error:'Forbidden',correlation_id:correlationId},403);
      const result=await admin.auth.admin.updateUserById(targetId,{password});
      if(result.error)return json({error:'Operation failed',correlation_id:correlationId},400);
      await audit('profile',targetId,{password_reset:true},String(body.justification||''));
      return json({ok:true,correlation_id:correlationId});
    }

    if(action==='disable'){
      const targetId=String(body.user_id||'');
      if(!targetId||targetId===userId||owner?.user_id===targetId)return json({error:'Invalid target',correlation_id:correlationId},400);
      const result=await admin.from('profiles').update({account_state:'disabled'}).eq('id',targetId);
      if(result.error)return json({error:'Operation failed',correlation_id:correlationId},400);
      await audit('profile',targetId,{account_state:'disabled'},String(body.justification||''));
      return json({ok:true,correlation_id:correlationId});
    }

    if(action==='delete'){
      const targetId=String(body.user_id||'');
      if(!targetId||targetId===userId||owner?.user_id===targetId)return json({error:'Invalid target',correlation_id:correlationId},400);
      const target=await admin.from('profiles').select('role').eq('id',targetId).maybeSingle();
      if(target.data?.role==='admin'&&!isOwner)return json({error:'Forbidden',correlation_id:correlationId},403);
      const {count:configCount}=await admin.from('v21_teacher_day_manipulations').select('teacher_id',{count:'exact',head:true}).eq('teacher_id',targetId).eq('active',true);
      if((configCount||0)>0)return json({error:'Remove teacher from V21 intervention configuration before deleting the account',code:'TEACHER_CONFIGURED',correlation_id:correlationId},409);
      const result=await admin.auth.admin.deleteUser(targetId);
      if(result.error)return json({error:'Operation failed',correlation_id:correlationId},400);
      await audit('profile',targetId,{deleted:true},String(body.justification||''));
      return json({ok:true,correlation_id:correlationId});
    }

    return json({error:'Unknown action',correlation_id:correlationId},400);
  }catch(error){
    console.error('admin-teacher',error);
    return json({error:'Operation unavailable',code:'INTERNAL_ERROR',correlation_id:correlationId},500);
  }
});
