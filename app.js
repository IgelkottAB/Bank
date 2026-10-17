(()=>{
const $=id=>document.getElementById(id), say=(s,error=false)=>{ $('status').textContent=s;$('status').className='notice'+(error?' error':'');};
if(!window.BANK_URL?.startsWith('https://')||!window.BANK_PUBLISHABLE_KEY||window.BANK_PUBLISHABLE_KEY.includes('KLIStra')){say('Fyll i config.js med bankprojektets Project URL och publishable key.',true);return;}
const db=window.supabase.createClient(window.BANK_URL,window.BANK_PUBLISHABLE_KEY);
let current=null,accounts=[];
const kr=n=>new Intl.NumberFormat('sv-SE').format(n)+' kr';
const err=e=>say(e?.message||'Något gick fel.',true);
async function refresh(){
const [a,p,t,g]=await Promise.all([db.from('bank_accounts').select('id,kind,name,balance').order('created_at'),db.from('bank_profiles').select('display_name').single(),db.from('bank_transactions').select('id,amount,description,created_at').order('created_at',{ascending:false}).limit(20),db.from('bank_goals').select('id,name,target').order('created_at',{ascending:false})]);
for(const r of [a,p,t,g])if(r.error)throw r.error;
accounts=a.data;$('greeting').textContent='Hej, '+p.data.display_name+'!';
$('accounts').replaceChildren(...accounts.map(x=>{let e=document.createElement('div');e.className='account';let title=document.createElement('div');title.textContent=x.name;let sum=document.createElement('div');sum.className='balance';sum.textContent=kr(x.balance);e.append(title,sum);return e;}));
for(const id of ['from','to']){$(id).replaceChildren(...accounts.map(x=>{let o=document.createElement('option');o.value=x.id;o.textContent=x.name+' – '+kr(x.balance);return o;}));}
if(accounts.length>1)$('to').selectedIndex=1;
$('history').replaceChildren(...t.data.map(x=>{let li=document.createElement('li');li.textContent=new Date(x.created_at).toLocaleString('sv-SE')+' – '+x.description+': '+kr(x.amount);return li;}));
$('goals').replaceChildren(...g.data.map(x=>{let li=document.createElement('li');li.textContent=x.name+' – mål: '+kr(x.target)+' ';let b=document.createElement('button');b.textContent='Ta bort';b.className='secondary';b.onclick=async()=>{const r=await db.from('bank_goals').delete().eq('id',x.id);if(r.error)err(r.error);else refresh().catch(err);};li.append(b);return li;}));
say('Inloggad. All information hämtas från ditt eget konto.');
}
async function update(){const {data:{user},error}=await db.auth.getUser();if(error&&!/session missing/i.test(error.message))throw error;current=user;$('auth').classList.toggle('hidden',!!user);$('dashboard').classList.toggle('hidden',!user);if(user)await refresh();else say('Logga in eller registrera en kund.');}
$('showRegister').onclick=()=>$('register').classList.toggle('hidden');
$('login').onsubmit=async e=>{e.preventDefault();say('Loggar in...');const {error}=await db.auth.signInWithPassword({email:$('email').value.trim(),password:$('password').value});if(error)err(error);else update().catch(err);};
$('register').onsubmit=async e=>{e.preventDefault();say('Registrerar...');const {data,error}=await db.auth.signUp({email:$('newEmail').value.trim(),password:$('newPassword').value,options:{data:{display_name:$('name').value.trim()}}});if(error)return err(error);if(!data.session){say('Kontot har skapats. Bekräfta e-postmeddelandet och logga sedan in.');return;}update().catch(err);};
$('logout').onclick=async()=>{const {error}=await db.auth.signOut();if(error)err(error);else update().catch(err);};
$('transfer').onsubmit=async e=>{e.preventDefault();const n=Number($('amount').value);if(!Number.isSafeInteger(n)||n<1||n>1000000)return say('Ange ett giltigt heltalsbelopp.',true);say('Genomför överföringen...');const {error}=await db.rpc('bank_transfer',{p_from:$('from').value,p_to:$('to').value,p_amount:n});if(error)err(error);else{ $('amount').value='';refresh().catch(err);}};
$('goalForm').onsubmit=async e=>{e.preventDefault();const n=Number($('goalTarget').value);if(!Number.isSafeInteger(n)||n<1)return say('Ange ett giltigt målbelopp.',true);const {error}=await db.from('bank_goals').insert({owner_id:current.id,name:$('goalName').value.trim(),target:n});if(error)err(error);else{$('goalForm').reset();refresh().catch(err);}};
db.auth.onAuthStateChange(()=>{setTimeout(()=>update().catch(err),0);});update().catch(err);
})();
