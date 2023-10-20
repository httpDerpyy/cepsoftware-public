// Server
require('dotenv').config()

const express = require('express')
const path = require('path')
const fetch = require('node-fetch')
const cors = require('cors')
const fs = require('fs')

const app = express()
const port = process.env.PORT || 25565;

const cepFlashback = process.env.GEOLOCATION_FLASHBACK

app.use(cors())
app.use(express.static(__dirname + '/public'))

// API do Google Maps
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY

// Banco de Dados
const { MongoClient } = require('mongodb');
const url = process.env.MONGODB_API_KEY

let database = null

MongoClient.connect(url, (err, db) => {
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

                    // Puxar Geolocalização
                    const geo = `https://maps.googleapis.com/maps/api/geocode/json?key=${GOOGLE_API_KEY}&address=${cepAlvo}`

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

                            const geo2 = `https://maps.googleapis.com/maps/api/geocode/json?key=${GOOGLE_API_KEY}&latlng=${lat},${lng}`

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
                                    const check = `https://maps.googleapis.com/maps/api/directions/json?origin=${cepFlashback}&destination=${cepAlvo}&key=${GOOGLE_API_KEY}`

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

                                            // Salva o CEP no Mongo para evitar futuras chamadas no API
                                            try {
                                                responseData.cep = Number(cepAlvo)
                                                ceps.insertOne(responseData)
                                            } catch(e) {
                                                console.log(e)
                                            } finally {
                                                console.log("CEP Salvo no Mongo")
                                            }

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

app.get("/banco", (req, res) => {
    res.sendFile(path.join(__dirname, "public/banco.html"))
})

app.get("/contatos", (req, res) => {
    
    let banco_geral = database.db('contatos')
    let contatos = banco_geral.collection('contatoscollection')

    contatos.find({}).toArray().then(format => res.send(format))

})

app.get('/download-contatos', (req, res) => {

    let banco_geral = database.db('contatos')
    let contatos = banco_geral.collection('contatoscollection')

    let str = ""

    contatos.find({}).toArray().then(format => {
        format.forEach(contact => {
            str = str + contact.title.split(" ")[1] + "," + contact.phone + "\r\n"
        })
        fs.writeFile("./public/contatos.txt", str, (err) => {
            if (err) {
                console.log(err)
                res.send({ok: false, error: err})
                return;
            } else {
                res.send({ok: true})
                return
            }
        })
    })

})
// HTTP Posts
app.post("/remover-contato", (req, res) => {

    let banco_geral = database.db('contatos')
    let contatos = banco_geral.collection('contatoscollection')

    req.on('data', (data) => {
        data = JSON.parse(data)
        contatos.deleteOne({title: data.Contato}).then(response => {
            res.send({ok: response.acknowledged})
        })
    })
})

app.post("/adicionar-contato", (req, res) => {

    let banco_geral = database.db('contatos')
    let contatos = banco_geral.collection('contatoscollection')

    req.on('data', (data) => {

        data = JSON.parse(data)
        contatos.findOne({title: data.title}).then(document => {
            if (document != null) {
                contatos.updateOne({title: data.title}, {$set: {"phone": data.phone} }).then(result => {
                    res.send({ok: result.acknowledged})
                })
            } else {
                contatos.insertOne({title: data.title , phone: data.phone}).then(result => {
                    res.send({ok: result.acknowledged})
                })
            }
        })

    })

})

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