import pkg from "ssh2"
const { Server } = pkg
import fs from "fs"
import { v4 as uuidv4 } from "uuid"

const activeTunnels = {}

const sshServer = new Server({
  hostKeys: [fs.readFileSync("host.key")],
})

sshServer.on("connection", (client, info) => {
  console.log(`SSH Connected from ${info.ip}`)

  client.on("authentication", (ctx) => {
    client.username = ctx.username?.toLowerCase() || "user"
    client.sessionId = uuidv4()
    console.log(client.sessionId)

    console.log("username", client.username, client.sessionId)
    ctx.accept()
  }) // No authentication

  client.on("ready", () => {
    console.log("Client authenticated!")

    console.log({ activeTunnels })

    client.on("session", (accept) => {
      const session = accept()
      session.on("pty", (accept) => accept && accept())
      session.on("shell", (accept) => {
        const stream = accept()

        const user = activeTunnels[client.username]

        if (user) {
          stream.close()
          session.close
        }
        activeTunnels[client.username] = { sessionId: client.sessionId }
        stream.write(`Hi.. ${client.username} Welcome to SSH Tunnel server!`)
        stream.on("data", (data) => {
          // CTRL + C = ASCII 3
          if (data[0] === 3) {
            stream.close()
            session.close
          }
        })
      })
    })

    client.on("end", () => {
      console.log(`❌ Disconnected: ${client.username}`)
      delete activeTunnels[client.username]
    })
  })
})

sshServer.listen(22, "0.0.0.0", () => {
  console.log("SSH server listening on port 22")
})
