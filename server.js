import pkg from "ssh2"
const { Server } = pkg
import fs from "fs"

const sshServer = new Server({
  hostKeys: [fs.readFileSync("host.key")],
})

sshServer.on("connection", (client, info) => {
  console.log(`SSH Connected from ${info.ip}`)

  client.on("authentication", (ctx) => ctx.accept()) // No authentication

  client.on("ready", () => {
    console.log("Client authenticated!")

    client.on("session", (accept) => {
      const session = accept()
      session.on("pty", (accept) => accept && accept())
      session.on("shell", (accept) => {
        const stream = accept()
        stream.write("Welcome to your Node.js SSH server!")
        stream.on("data", (data) => {
          // CTRL + C = ASCII 3
          if (data[0] === 3) {
            stream.close()
            session.close
          }
        })
      })
    })
  })
})

sshServer.listen(22, "0.0.0.0", () => {
  console.log("SSH server listening on port 22")
})
