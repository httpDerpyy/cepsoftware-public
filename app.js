// Server
const express = require('express')
const path = require('path')
const fetch = require('node-fetch')
const cors = require('cors')

const app = express()
const port = 25565

const cepFlashback = "-23.4594742,-46.5365758"

app.use(cors())
app.use(express.static(__dirname + '/public'))

// Banco de Dados
const { MongoClient } = require('mongodb');
const url = "mongodb+srv://Gabriel:shadowcat24@clusterflashback.3putl.mongodb.net/test"

let database = null

const Mongo = MongoClient.connect(url, (err, db) => {
    if (err) { console.log(err); return; }
    database = db
})

// End-points
app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, 'public/index.html'))
})

app.get("/config", (req, res) => {
    res.sendFile(path.join(__dirname, "public/configuração.html"))
})

app.get("/registro", (req, res) => {
    res.sendFile(path.join(__dirname, "public/registro.html"))
})

app.get("/cep", (req, res) => {

    const cepAlvo = req.query.alvo
    let responseData = {}

    // Tentar buscar CEP no banco de dados privado primero
    let banco_geral = database.db('cepsoftware')
    let ceps = banco_geral.collection('cepsregistrados')

    try {
        ceps.findOne({ cep: Number(cepAlvo) })
            .then(data => {
                if (data != null) { // Temos esse CEP registrado!

                    data.status = "OK"
                    res.send(data)
                    return;

                } else { // Usar a API do Google

                    // Terminar conexão com Mongo


                    // Puxar Geolocalização
                    const geo = "https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyAcUTU8IULsndQzoydzuzQkdMJFBIBzyg8&address=" + cepAlvo

                    fetch(geo)
                        .then(response => response.json())
                        .then(data => {

                            if (data.status != "OK") {
                                console.log(data)
                                res.send({ status: "ERROR" })
                                return;
                            }

                            // Puxar Endereço
                            const lat = data.results[0].geometry.location.lat
                            const lng = data.results[0].geometry.location.lng

                            const geo2 = `https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyAcUTU8IULsndQzoydzuzQkdMJFBIBzyg8&latlng=${lat},${lng}`

                            fetch(geo2)
                                .then(response => response.json())
                                .then(data => {

                                    let components = data.results[0].address_components

                                    if (components == undefined) {
                                        res.send({ status: "ERROR!" })
                                        return;
                                    }

                                    const c1 = components[1] ? components[1] : { short_name: "" }
                                    const c2 = components[2] ? components[2] : { short_name: "" }
                                    const c6 = components[6] ? components[6] : { short_name: "" }

                                    responseData.address = c1.short_name + ", " + c2.short_name + ", " + c6.short_name

                                    // Checagem de distancia
                                    const check = `https://maps.googleapis.com/maps/api/directions/json?origin=${cepFlashback}&destination=${cepAlvo}&key=AIzaSyAcUTU8IULsndQzoydzuzQkdMJFBIBzyg8`

                                    fetch(check)
                                        .then(response => response.json())
                                        .then(data => {

                                            if (data.routes[0] == undefined) {
                                                res.send({ status: "ERROR" })
                                                return;
                                            }

                                            responseData.distanceText = data.routes[0].legs[0].distance.text
                                            responseData.distanceValue = data.routes[0].legs[0].distance.value
                                            responseData.status = "OK"

                                            res.send(responseData)

                                        })

                                })

                        })

                }
            })

    } catch (e) {
        console.log(e)
        res.send({ status: "ERROR" })
        return;
    }

})


app.get("/data", (req, res) => {

    let responseBody = {}

    // Banco de Dados
    let banco_geral = database.db('cepsoftware')

    // Motoboys
    let banco_motoboys = banco_geral.collection('motoboys')
    try {
        banco_motoboys.find({}).toArray()
            .then(formatted => {

                responseBody.Motoboys = formatted

                // Metragens
                let banco_metragens = banco_geral.collection('kilometragem')
                try {
                    banco_metragens.find({}).toArray()
                        .then(formatted_kilometragem => {

                            responseBody.Metragens = formatted_kilometragem

                            responseBody.status = "OK"
                            res.send(responseBody)

                            return;

                        })
                } catch (e) {
                    console.log(e)
                    res.send({ status: "ERROR!" })

                    return;
                }

            })

    } catch (e) {
        console.log(e)
        res.send({ status: "ERROR!" })

        return;
    }

})

// HTTP Posts
app.post("/data", (req, res) => {
    req.on('data', (data) => {
        data = JSON.parse(data)

        // Banco de Dados
        let banco_geral = database.db('cepsoftware')

        // Motoboys
        let banco_motoboys = banco_geral.collection('motoboys')
        try {
            banco_motoboys.deleteMany({})
            banco_motoboys.insertMany(data.Motoboys)
        } catch (e) {
            console.log(e)
            res.send({ status: "ERROR!" })

            return;
        }

        // Metragens
        let banco_metragens = banco_geral.collection('kilometragem')
        try {
            banco_metragens.deleteMany({})
            banco_metragens.insertMany(data.Metragens)
        } catch (e) {
            console.log(e)
            res.send({ status: "ERROR!" })
            return;
        }

        res.send({ status: "OK" })




    })

})

app.post("/registroCEP", (req, res) => {
    req.on('data', (data) => {

        data = JSON.parse(data)

        let banco_geral = database.db('cepsoftware')
        let registro_ceps = banco_geral.collection('cepsregistrados')

        try {
            registro_ceps.insertOne(data.Package)
        } catch (e) {
            res.send({ status: "ERROR" })
            console.log(e)

            return;
        }

        res.send({ status: "OK" })

        return;


    })
})

app.listen(port, () => {
    console.log('Ready!')
})