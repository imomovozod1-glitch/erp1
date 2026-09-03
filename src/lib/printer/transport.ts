/**
 * USB and Bluetooth transports for sending raw ESC/POS bytes straight to a
 * receipt printer, bypassing the OS print dialog entirely.
 *
 * Platform reality (worth knowing before debugging a "won't connect" report):
 * - WebUSB: Chrome/Edge desktop only, requires HTTPS (or localhost). Not
 *   supported in Safari or Firefox at all. Some OSes (notably Windows, and
 *   macOS with a kernel driver installed) attach a printer-class driver to
 *   the USB device before the page ever gets a chance to claim it — the
 *   pairing prompt will show the device, but `open()`/`claimInterface()` can
 *   still throw if the OS driver won't release it. Uninstalling any
 *   OS-level driver for the printer (Windows: "Devices and Printers") is the
 *   usual fix, or fall back to the "system" connection type below.
 * - Web Bluetooth: Chrome desktop + Chrome/Android. NOT supported in Safari
 *   on any platform (iOS or macOS) — this is an Apple platform restriction,
 *   not a bug here. Web Bluetooth also only speaks BLE (GATT); a printer
 *   that only offers classic Bluetooth SPP (common on older/cheaper
 *   hardware) is invisible to it no matter what.
 * - Raw TCP to a network printer's port 9100 is not something a browser tab
 *   can do at all (no raw-socket API exists in web platform) — see
 *   printer-settings.tsx for how "network" printers are actually handled.
 */

import { getPrinterConfig } from './storage'

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.usb
}

export function isWebBluetoothSupported(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.bluetooth
}

// ─── USB ────────────────────────────────────────────────────────────────

export async function requestUsbPrinter(): Promise<USBDevice> {
  if (!navigator.usb) throw new Error('WebUSB not supported in this browser')
  return navigator.usb.requestDevice({ filters: [{}] })
}

export async function getPairedUsbPrinter(): Promise<USBDevice | null> {
  if (!navigator.usb) return null
  const devices = await navigator.usb.getDevices()
  return devices[0] ?? null
}

async function findUsbOutEndpoint(device: USBDevice): Promise<{ interfaceNumber: number; endpointNumber: number }> {
  const config = device.configuration
  if (!config) throw new Error('USB device has no active configuration')
  for (const iface of config.interfaces) {
    const outEndpoint = iface.alternate.endpoints.find((e) => e.direction === 'out')
    if (outEndpoint) return { interfaceNumber: iface.interfaceNumber, endpointNumber: outEndpoint.endpointNumber }
  }
  throw new Error('No USB OUT endpoint found — this device may not be a printer')
}

export async function sendViaUsb(device: USBDevice, bytes: Uint8Array): Promise<void> {
  if (!device.opened) await device.open()
  if (device.configuration === null) await device.selectConfiguration(1)
  const { interfaceNumber, endpointNumber } = await findUsbOutEndpoint(device)
  await device.claimInterface(interfaceNumber)
  await device.transferOut(endpointNumber, bytes)
}

// ─── Bluetooth (BLE) ────────────────────────────────────────────────────

export async function requestBluetoothPrinter(): Promise<BluetoothDevice> {
  if (!navigator.bluetooth) throw new Error('Web Bluetooth not supported in this browser')
  const { bleServiceUuid } = getPrinterConfig()
  return navigator.bluetooth.requestDevice({
    filters: [{ services: [bleServiceUuid] }],
    optionalServices: [bleServiceUuid],
  })
}

export async function sendViaBluetooth(device: BluetoothDevice, bytes: Uint8Array): Promise<void> {
  const { bleServiceUuid, bleCharacteristicUuid } = getPrinterConfig()
  if (!device.gatt) throw new Error('Device has no GATT server')
  const server = device.gatt.connected ? device.gatt : await device.gatt.connect()
  const service = await server.getPrimaryService(bleServiceUuid)
  const characteristic = await service.getCharacteristic(bleCharacteristicUuid)

  // BLE has a per-write payload cap (typically ~20 bytes on older stacks,
  // more with modern MTU negotiation) — chunk defensively so a full receipt
  // (easily 500+ bytes) doesn't silently get truncated.
  const CHUNK_SIZE = 180
  for (let offset = 0; offset < bytes.length; offset += CHUNK_SIZE) {
    const chunk = bytes.slice(offset, offset + CHUNK_SIZE)
    await characteristic.writeValueWithoutResponse(chunk)
  }
}
