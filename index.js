const config = require("./environment")
const cronjobs = require("./cronjobs")
const app = require("express")


app().listen(process.env.PORT, () =>{

    console.log(new Date())

    cronjobs.initiate()
})