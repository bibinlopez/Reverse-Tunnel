import pkg from "ssh2"
const { Server } = pkg
import fs from "fs"

const sshServer = new Server({
  hostKeys: [fs.readFileSync("host.key")],
})

sshServer.listen(22, "0.0.0.0", () => {
  console.log("SSH server listening on port 22")
})
