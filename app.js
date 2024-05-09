const express = require('express')
const {open} = require('sqlite')
const sqlite3 = require('sqlite3')
const path = require('path')
const bcrypt = require('bcrypt')
const jwt = require('jsonwebtoken')

const app = express()
app.use(express.json())
const databasePath = path.join(__dirname, 'covid19IndiaPortal.db')
let db = null
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: databasePath,
      driver: sqlite3.Database,
    })
    app.listen(3000, () =>
      console.log('Server Running at http://localhost:3000/'),
    )
  } catch (error) {
    console.log(`DB Error ${error.message}`)
    process.exit(1)
  }
}

initializeDbAndServer()

const convertStateDbobjToResponseObj = dbObject => {
  return {
    stateId: dbObject.state_id,
    stateName: dbObject.state_name,
    population: dbObject.population,
  }
}

const convertDistrictDbobjToResponseObj = dbObject => {
  return {
    districtId: dbObject.district_id,
    districtName: dbObject.district_name,
    stateId: dbObject.state_id,
    cases: dbObject.cases,
    cured: dbObject.cured,
    active: dbObject.active,
    deaths: dbObject.deaths,
  }
}

function authenticateToken(response, request, next) {
  let jwtToken = null
  const authHeader = request.headers['authorization']
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(' ')[1]
  }
  if (jwtToken === undefined) {
    response.status(401)
    response.send('Invalid JWT Token')
  } else {
    jwt.verify(jwtToken, 'MY_SECRET_TOKEN', async (error, payload) => {
      if (error) {
        response.status(401)
        response.send('Invalid JWT Token')
      } else {
        next()
      }
    })
  }
}

app.post('/login/', async (request, response) => {
  const {username, password} = request.body
  const selectUserQuery = `SELECT * FROM user WHERE username='${username}';`
  const databaseUser = await db.get(selectUserQuery)
  if (databaseUser === undefined) {
    response.status(400)
    response.send('Invalid user')
  } else {
    const isPasswordCheck = await bcrypt.compare(
      password,
      databaseUser.password,
    )
    if (isPasswordCheck === true) {
      const payload = {username: username}
      const jwtToken = jwt.sign(payload, 'MY_SECRET_TOKEN')
      response.send({jwtToken})
    } else {
      response.status(400)
      response.send('Invalid password')
    }
  }
})

app.get('/states/', authenticateToken, async (request, response) => {
  const getStatesQuery = `SELECT * FROM state`
  const statesResult = await db.all(getStatesQuery)
  response.send(
    statesResult.map(eachState => convertStateDbobjToResponseObj(eachState)),
  )
})

app.get('/states/:stateId', authenticateToken, async (request, response) => {
  const {stateId} = request.params
  const getStateQuery = `SELECT * FROM state WHERE state_id = ${stateId}`
  const stateResult = await db.get(getStateQuery)
  response.send(convertStateDbobjToResponseObj(stateResult))
})

app.get(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const getDistrictQuery = `SELECT 
                              * 
                              FROM 
                              district 
                              WHERE 
                              district_id = ${districtId}`
    const districtResult = await db.get(getDistrictQuery)
    response.send(convertDistrictDbobjToResponseObj(districtResult))
  },
)

app.post('/districts/', authenticateToken, async (request, response) => {
  const {stateId, districtName, cases, cured, active, deaths} = request.body
  const postDistrictQuery = `INSERT INTO 
                      district (state_id, district_name, cases, cured, active, deaths)
                        VALUES (
                          ${stateId},
                          '${districtName}',
                           ${cases},
                           ${cured},
                           ${active},
                           ${deaths}
                        )`
  await db.run(postDistrictQuery)
  response.send('Disctrict Successfully Added')
})

app.delete(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const deleteDistrictQuery = `DELETE FROM district WHERE district_id = ${districtId}`
    await db.run(deleteDistrictQuery)
    response.send('Disctrict Removed')
  },
)

app.put(
  '/districts/:districtId',
  authenticateToken,
  async (request, response) => {
    const {districtId} = request.params
    const {districtName, stateId, cases, cured, active, deaths} = request.body
    const putDistrictQuery = `UPDATE district 
                              SET 
                              district_name  = '${districtName}',
                              state_id = ${stateId},
                              cases = ${cases},
                              cured = ${cured},
                              active = ${active},
                              deaths =${deaths}
                              WHERE district_id = ${districtId}`
    await db.run(putDistrictQuery)
    response.send('Disctrict Details Updated')
  },
)

app.get(
  '/state/:stateId/:stats',
  authenticateToken,
  async (request, response) => {
    const {stateId} = request.params
    const getStatesQuery = `SELECT 
                              SUM(cases) AS totalCases,
                              SUM(cured) AS totalcured,
                              SUM(active) AS totalactive,
                              SUM(deaths) AS totaldeaths
                              FROM 
                              district 
                              WHERE 
                              state_id = ${stateId}`
    const stateResult = await db.get(getStatesQuery)
    response.send(convertDistrictDbobjToResponseObj(stateResult))
  },
)

module.exports = app
