window.SE_CONFIG = {
  url: 'https://qapppwgruymsnsxfvlda.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFhcHBwd2dydXltc25zeGZ2bGRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5Nzg0NTMsImV4cCI6MjEwOTU1NDQ1M30.CAveRJu5GnmjwBS9DyTirWzWGSqTckxGqLU8TTWsxAQ',
  googleClientId: '33369201098-8sl9tslq8hv1ia67pj07pblb7gf1tnni.apps.googleusercontent.com',
  googleAuth: true,   // Google provider is enabled in Supabase
  vapidPublic: 'BILleFe93kHT_onRWWis3MuJyidC7KsLAsNYlIqqBQIumJnRs_hViqAd_9MRy8XudzeieA4K245NS3KPAsvBvrA',   // Web Push public key (the private one stays in Supabase Vault)
  ai: false           // AI coach features; set true once ANTHROPIC_API_KEY is set on the coach-ai edge function
};
