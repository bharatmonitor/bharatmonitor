-- ============================================================================
-- BharatMonitor — BJP Kerala account setup (2 accounts)  [final, schema-matched]
--   1. Rajeev Chandrasekhar — Kerala BJP President & MLA (Nemom)
--   2. Suresh Gopi          — Union MoS & MP (Thrissur)
-- Matched to the live accounts schema. Only column omitted: watchlist_handles
-- (not in the table — add social handles via the app UI). Re-runnable.
-- Context: Kerala 2026 Assembly election (4 May 2026) — UDF/Congress landslide
-- (102 seats) ousted the LDF (35). Opposition-to-monitor is now Congress/UDF.
-- ============================================================================

-- ─── 1. RAJEEV CHANDRASEKHAR ────────────────────────────────────────────────
insert into public.accounts (
  id, user_id, created_by, is_active,
  account_type, politician_name, politician_initials, party, designation,
  constituency, constituency_type, state, district,
  keywords, excluded_keywords,
  tracked_politicians, tracked_parties, tracked_ministries, tracked_schemes,
  languages, geo_scope, alert_prefs,
  contact_email, email, tier,
  login_email, login_password, login_name, login_role, login_tier,
  created_at, updated_at
) values (
  'BM-2026-RCKERALA', '9999999999999999', '9999999999999999', true,
  'politician', 'Rajeev Chandrasekhar', 'RC', 'BJP', 'Kerala BJP President & MLA',
  'Nemom', 'vidhan_sabha', 'Kerala', 'Thiruvananthapuram',
  '["Rajeev Chandrasekhar","Kerala BJP president","BJP Kerala","Kerala BJP",
    "Nemom MLA","Nemom BJP","Viksit Keralam","Viksit Kerala","NDA Kerala",
    "Thiruvananthapuram BJP","Chandrasekhar Nemom","Kerala assembly BJP",
    "രാജീവ് ചന്ദ്രശേഖർ","വികസിത കേരളം","കേരള ബിജെപി","നേമം",
    "राजीव चंद्रशेखर","केरल बीजेपी"]'::jsonb,
  '["Rajiv Gandhi","Rajeev Gandhi","Chandrasekhar Azad","Chandra Shekhar",
    "Rajiv Pratap Rudy","K R Chandrasekhar"]'::jsonb,
  '[
    {"id":"tp-rc-1","name":"V.D. Satheesan","party":"INC","initials":"VDS","role":"Congress leader (UDF)","is_competitor":true},
    {"id":"tp-rc-2","name":"Shashi Tharoor","party":"INC","initials":"ST","role":"MP Thiruvananthapuram","is_competitor":true},
    {"id":"tp-rc-3","name":"Ramesh Chennithala","party":"INC","initials":"RCH","role":"Congress leader (UDF)","is_competitor":true},
    {"id":"tp-rc-4","name":"K.C. Venugopal","party":"INC","initials":"KCV","role":"Congress (UDF)","is_competitor":true},
    {"id":"tp-rc-5","name":"Chandy Oommen","party":"INC","initials":"CO","role":"Congress (UDF)","is_competitor":true},
    {"id":"tp-rc-6","name":"Pinarayi Vijayan","party":"CPI(M)","initials":"PV","role":"Former CM (LDF)","is_competitor":true},
    {"id":"tp-rc-7","name":"V. Sivankutty","party":"CPI(M)","initials":"VS","role":"LDF, defeated in Nemom","is_competitor":true},
    {"id":"tp-rc-8","name":"M.V. Govindan","party":"CPI(M)","initials":"MVG","role":"CPI(M) state secretary","is_competitor":true},
    {"id":"tp-rc-9","name":"Suresh Gopi","party":"BJP","initials":"SG","role":"Union MoS, MP Thrissur (ally)","is_competitor":false},
    {"id":"tp-rc-10","name":"K. Surendran","party":"BJP","initials":"KS","role":"Former Kerala BJP chief (ally)","is_competitor":false}
  ]'::jsonb,
  '["INC","CPI(M)","CPI","UDF","LDF"]'::jsonb,
  '["Kerala Tourism","Kerala Finance","Kerala Health","Kerala LSGD","Kerala Education"]'::jsonb,
  '["Viksit Keralam","Viksit Bharat","PM Awas Yojana","Ayushman Bharat","PM Kisan",
    "Jal Jeevan Mission","Ujjwala Yojana","Mudra Yojana",
    "Life Mission","K-FON","Karunya","Kudumbashree","KIIFB"]'::jsonb,
  '["malayalam","english","hindi"]'::jsonb,
  '[
    {"level":"state","name":"Kerala","state":"Kerala"},
    {"level":"constituency","name":"Nemom","state":"Kerala"},
    {"level":"district","name":"Thiruvananthapuram","state":"Kerala"}
  ]'::jsonb,
  '{"red_sms":false,"red_push":true,"red_email":true,"yellow_push":true,"yellow_email":true,"daily_digest":true}'::jsonb,
  'rajeev@bharatmonitor.online', 'rajeev@bharatmonitor.online', 'elections',
  'rajeev@bharatmonitor.online', 'ChangeMe@2026', 'Rajeev Chandrasekhar', 'user', 'elections',
  now(), now()
)
on conflict (id) do update set
  politician_name = excluded.politician_name, party = excluded.party,
  designation = excluded.designation, constituency = excluded.constituency,
  constituency_type = excluded.constituency_type, state = excluded.state, district = excluded.district,
  keywords = excluded.keywords, excluded_keywords = excluded.excluded_keywords,
  tracked_politicians = excluded.tracked_politicians, tracked_parties = excluded.tracked_parties,
  tracked_ministries = excluded.tracked_ministries, tracked_schemes = excluded.tracked_schemes,
  languages = excluded.languages, geo_scope = excluded.geo_scope, alert_prefs = excluded.alert_prefs,
  tier = excluded.tier, is_active = true, updated_at = now();


-- ─── 2. SURESH GOPI ─────────────────────────────────────────────────────────
insert into public.accounts (
  id, user_id, created_by, is_active,
  account_type, politician_name, politician_initials, party, designation,
  constituency, constituency_type, state, district,
  keywords, excluded_keywords,
  tracked_politicians, tracked_parties, tracked_ministries, tracked_schemes,
  languages, geo_scope, alert_prefs,
  contact_email, email, tier,
  login_email, login_password, login_name, login_role, login_tier,
  created_at, updated_at
) values (
  'BM-2026-SGTHRSSR', '9999999999999999', '9999999999999999', true,
  'politician', 'Suresh Gopi', 'SG', 'BJP', 'Union Minister of State & MP (Thrissur)',
  'Thrissur', 'lok_sabha', 'Kerala', 'Thrissur',
  '["Suresh Gopi","Thrissur MP","Union Minister Suresh Gopi","Suresh Gopi minister",
    "BJP Thrissur","NDA Thrissur","Suresh Gopi tourism","Guruvayur BJP",
    "Suresh Gopi Lok Sabha","Minister of State Tourism",
    "സുരേഷ് ഗോപി","തൃശൂർ ബിജെപി","ഗുരുവായൂർ",
    "सुरेश गोपी","त्रिशूर बीजेपी"]'::jsonb,
  '["movie","film","box office","trailer","teaser","shooting","release date",
    "OTT","cinema","superstar movie","Suresh Gopi film","Suresh Gopi movie","megastar"]'::jsonb,
  '[
    {"id":"tp-sg-1","name":"K. Muraleedharan","party":"INC","initials":"KM","role":"Congress, Thrissur rival","is_competitor":true},
    {"id":"tp-sg-2","name":"V.S. Sunil Kumar","party":"CPI","initials":"SK","role":"CPI, Thrissur rival","is_competitor":true},
    {"id":"tp-sg-3","name":"V.D. Satheesan","party":"INC","initials":"VDS","role":"Congress leader (UDF)","is_competitor":true},
    {"id":"tp-sg-4","name":"Shashi Tharoor","party":"INC","initials":"ST","role":"MP Thiruvananthapuram","is_competitor":true},
    {"id":"tp-sg-5","name":"Pinarayi Vijayan","party":"CPI(M)","initials":"PV","role":"Former CM (LDF)","is_competitor":true},
    {"id":"tp-sg-6","name":"M.V. Govindan","party":"CPI(M)","initials":"MVG","role":"CPI(M) state secretary","is_competitor":true},
    {"id":"tp-sg-7","name":"Rajeev Chandrasekhar","party":"BJP","initials":"RC","role":"Kerala BJP president (ally)","is_competitor":false}
  ]'::jsonb,
  '["INC","CPI(M)","CPI","UDF","LDF"]'::jsonb,
  '["Ministry of Tourism","Ministry of Petroleum and Natural Gas","Kerala Tourism"]'::jsonb,
  '["Swadesh Darshan","PRASHAD","Dekho Apna Desh","Ujjwala Yojana","PM Awas Yojana",
    "Ayushman Bharat","Viksit Bharat","Guruvayur development","Thrissur Pooram"]'::jsonb,
  '["malayalam","english","hindi"]'::jsonb,
  '[
    {"level":"state","name":"Kerala","state":"Kerala"},
    {"level":"constituency","name":"Thrissur","state":"Kerala"},
    {"level":"district","name":"Thrissur","state":"Kerala"}
  ]'::jsonb,
  '{"red_sms":false,"red_push":true,"red_email":true,"yellow_push":true,"yellow_email":true,"daily_digest":true}'::jsonb,
  'sureshgopi@bharatmonitor.online', 'sureshgopi@bharatmonitor.online', 'elections',
  'sureshgopi@bharatmonitor.online', 'ChangeMe@2026', 'Suresh Gopi', 'user', 'elections',
  now(), now()
)
on conflict (id) do update set
  politician_name = excluded.politician_name, party = excluded.party,
  designation = excluded.designation, constituency = excluded.constituency,
  constituency_type = excluded.constituency_type, state = excluded.state, district = excluded.district,
  keywords = excluded.keywords, excluded_keywords = excluded.excluded_keywords,
  tracked_politicians = excluded.tracked_politicians, tracked_parties = excluded.tracked_parties,
  tracked_ministries = excluded.tracked_ministries, tracked_schemes = excluded.tracked_schemes,
  languages = excluded.languages, geo_scope = excluded.geo_scope, alert_prefs = excluded.alert_prefs,
  tier = excluded.tier, is_active = true, updated_at = now();


-- ─── Verify ─────────────────────────────────────────────────────────────────
select id, politician_name, party, designation, state, constituency, tier,
       jsonb_array_length(keywords) as kw, jsonb_array_length(tracked_politicians) as tracked,
       login_email, login_tier
from public.accounts
where id in ('BM-2026-RCKERALA','BM-2026-SGTHRSSR');
