// Server

const express = require('express')
const path = require('path')
const fetch = require('node-fetch')
const res = require('express/lib/response')

const app = express()
const port = 25565

const cepFlashback = "07094000"

app.get("/", ( request, response ) => {
    response.sendFile( path.join(__dirname, 'index.html') )
})

app.get("/cep", ( request, res ) => {

    const cepAlvo = request.query.alvo
    let responseData = {}

    // Puxar Geolocalização
    const geo = "https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyAcUTU8IULsndQzoydzuzQkdMJFBIBzyg8&address=" + cepAlvo
    
    fetch(geo)
    .then( response => response.json() )
    .then( data => {

        if ( data.status != "OK" ) {
            console.log( data )
            res.send( { status: "ERROR" } )
            return;
        }

        // Puxar Endereço
        const lat = data.results[0].geometry.location.lat
        const lng = data.results[0].geometry.location.lng

        const geo2 = `https://maps.googleapis.com/maps/api/geocode/json?key=AIzaSyAcUTU8IULsndQzoydzuzQkdMJFBIBzyg8&latlng=${lat},${lng}`

        fetch(geo2)
        .then( response => response.json() )
        .then( data => {

            let components = data.results[0].address_components
            responseData.address = components[1].short_name + ", " + components[2].short_name + ", " + components[3].short_name + ", " + components[6].short_name 

            // Checagem de distancia
            const check = `https://maps.googleapis.com/maps/api/directions/json?origin=${cepFlashback}&destination=${cepAlvo}&key=AIzaSyAcUTU8IULsndQzoydzuzQkdMJFBIBzyg8`

            fetch(check)
            .then( response => response.json() )
            .then( data => {
        
                responseData.distanceText = data.routes[0].legs[0].distance.text
                responseData.distanceValue = data.routes[0].legs[0].distance.value
                responseData.status = "OK"

                res.send( responseData )
        
            } )

        })

    } )



})


app.listen(port, () => {
    console.log('Ready!')
})