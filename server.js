import pkg from "ssh2"
const { Server } = pkg
import fs from "fs"

const activeTunnels = {}

const sshServer = new Server({
  hostKeys: [fs.readFileSync("host.key")],
})

sshServer.on("connection", (client, info) => {
  console.log(`SSH Connected from ${info.ip}`)

  client.on("authentication", (ctx) => {
    client.username = ctx.username?.toLowerCase() || "user"
    console.log("username", client.username)
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
        const username = client.username
        if (activeTunnels[username]) {
          stream.close()
          session.close
        }
        activeTunnels[client.username] = {}
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
