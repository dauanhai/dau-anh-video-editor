// Work Mode's Linux sandbox denies interface enumeration. This test-only
// fallback supplies the actual loopback interface used by the test servers.
import os from "node:os";
try {
  os.networkInterfaces();
} catch {
  os.networkInterfaces = () => ({
    lo: [
      {
        address: "127.0.0.1",
        netmask: "255.0.0.0",
        family: "IPv4",
        mac: "00:00:00:00:00:00",
        internal: true,
        cidr: "127.0.0.1/8",
      },
    ],
  });
}
