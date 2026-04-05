const {Pool}=require("pg")
const config=require("./config")

//Establish connection to db
const dbUrl = config.database.DATASOURCE_URL || process.env.DATASOURCE_URL;

if (!dbUrl) {
  console.error("❌ ERROR: No Database URL found in Environment Variables!");
} else {
  console.log("🐘 Database URL detected. Initializing pool...");
}

const pool=new Pool(
  {
   connectionString: dbUrl,
  ssl: {
    rejectUnauthorized: false 
  }
  }
);

// Create tables for our db in case they dont exist
async function DbTablesSetup(){

  try{
    await pool.query(
      
      `
      CREATE TABLE IF NOT EXISTS users 
      (
      telegram_id BIGINT PRIMARY KEY ,
      email VARCHAR(254),
      refresh_token TEXT,
      access_token TEXT,
      expiry_date TIMESTAMP ,
      last_seen TIMESTAMP DEFAULT NOW(),
      created_at TIMESTAMP DEFAULT NOW()
      );
    
      CREATE TABLE IF NOT EXISTS oauth_states (
        state        TEXT PRIMARY KEY,
        telegram_id  BIGINT NOT NULL,
        created_at   TIMESTAMP DEFAULT NOW()
      );
    
      CREATE TABLE IF NOT EXISTS drafts (
        telegram_id  BIGINT PRIMARY KEY,
        data         TEXT NOT NULL,
        updated_at   TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS activity_log (
        id           SERIAL PRIMARY KEY,
        telegram_id  BIGINT,
        action       TEXT NOT NULL,
        detail       TEXT,
        created_at   TIMESTAMP DEFAULT NOW()
      );
    
      `
    )
  }
  catch(err){
    console.log(err);
  }

}

// DbTablesSetup()

// Export database queries as statements
const statements={
     upsertUser: async (data)=>{
        const sql = `
      INSERT INTO users (telegram_id, email, access_token, refresh_token, expiry_date, last_seen)
      VALUES ($1, $2, $3, $4, $5, NOW())
      ON CONFLICT (telegram_id) DO UPDATE SET
        email = EXCLUDED.email,
        access_token = EXCLUDED.access_token,
        refresh_token = COALESCE(EXCLUDED.refresh_token, users.refresh_token),
        expiry_date = EXCLUDED.expiry_date,
        last_seen = NOW()
    `;
    const params = [data.telegram_id, data.email, data.access_token, data.refresh_token, data.expiry_date];
    return pool.query(sql, params);
    },
  getUser:    (telegram_id)=>{
    const query=('SELECT * FROM users WHERE telegram_id = $1');
     const params = [telegram_id];
    return pool.query(query, params);
  },
  deleteUser: (telegram_id)=>{const query=('DELETE FROM users WHERE telegram_id = $1')
     const params = [telegram_id];
    return pool.query(query, params);
  },
  allUsers: ()=> { const query=('SELECT telegram_id, email, last_seen, created_at FROM users ORDER BY last_seen DESC')
    //  const params = [data.telegram_id,data.email,data.last_seen,data.created_at];
    return pool.query(query);
  },
 
  saveState:   (state,telegram_id)=>{const query=('INSERT INTO oauth_states (state, telegram_id) VALUES ($1, $2)')
     const params = [state,telegram_id];
    return pool.query(query, params);
  },
  getState:  (state)=> { const query=('SELECT telegram_id FROM oauth_states WHERE state = $1')
     const params = [state];
    return pool.query(query, params);
  },
  deleteState:(telegram_id)=>{ const query=('DELETE FROM oauth_states WHERE state = $1')
     const params = [telegram_id];
    return pool.query(query, params);
  },
  cleanStates: ()=>{const query=("DELETE FROM oauth_states WHERE created_at < NOW() - INTERVAL '10 minutes'")
    //  const params = [data.telegram_id];
    return pool.query(query);
  },

  // check this
  saveDraft:  (telegram_id,data)=>{ 
    const query=`INSERT INTO drafts (telegram_id, data, updated_at) 
    VALUES ($1, $2,NOW())
     ON CONFLICT (telegram_id) DO UPDATE SET 
      data = EXCLUDED.data, 
      updated_at = NOW()`;
     const params = [telegram_id,data];
    return pool.query(query, params);
  },
  getDraft:  (telegram_id)=> { const query=('SELECT data FROM drafts WHERE telegram_id = $1')
     const params = [telegram_id];
    return pool.query(query, params);
  },
  deleteDraft:(telegram_id)=>{ const query=('DELETE FROM drafts WHERE telegram_id = $1')
     const params = [telegram_id];
    return pool.query(query, params);
  },
 
  logActivity:(telegram_id,action,details)=>{ const query=('INSERT INTO activity_log (telegram_id, action, detail) VALUES ($1,$2, $3)')
     const params = [telegram_id,action,details];
    return pool.query(query, params);
  },
  recentActivity: ()=>{const query=('SELECT * FROM activity_log ORDER BY created_at DESC LIMIT 50')
    
    return pool.query(query);
  },
  activityCount:()=>{ const query=('SELECT COUNT(*) as cnt FROM activity_log')
    return pool.query(query);
  },
  userCount:()=>{ const query=('SELECT COUNT(*) as cnt FROM users')
    return pool.query(query);
  },
  touchUser:(telegram_id)=>{
    const params=[telegram_id]
    const sql="UPDATE users SET last_seen=NOW() WHERE telegram_id=$1"
    return pool.query(sql,params)
  }
}
module.exports={statements,DbTablesSetup};