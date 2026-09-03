/**
 * Minimal ambient declarations for the WebUSB and Web Bluetooth APIs — just
 * the surface this module actually calls. TypeScript's DOM lib doesn't ship
 * these (they're not yet part of the standard `lib.dom.d.ts`), and pulling in
 * a full @types package for a handful of calls isn't worth the dependency.
 */

interface USBDevice {
  readonly vendorId: number
  readonly productId: number
  readonly productName?: string
  readonly opened: boolean
  readonly configuration: { interfaces: USBInterface[] } | null
  open(): Promise<void>
  close(): Promise<void>
  selectConfiguration(configurationValue: number): Promise<void>
  claimInterface(interfaceNumber: number): Promise<void>
  transferOut(endpointNumber: number, data: Uint8Array): Promise<{ status: string; bytesWritten: number }>
}

interface USBInterface {
  interfaceNumber: number
  alternate: { endpoints: USBEndpoint[] }
}

interface USBEndpoint {
  endpointNumber: number
  direction: 'in' | 'out'
}

interface USBDeviceRequestOptions {
  filters: { vendorId?: number; productId?: number }[]
}

interface USB {
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>
  getDevices(): Promise<USBDevice[]>
}

interface BluetoothRemoteGATTCharacteristic {
  writeValueWithoutResponse(data: Uint8Array): Promise<void>
  writeValue(data: Uint8Array): Promise<void>
}

interface BluetoothRemoteGATTService {
  getCharacteristic(characteristic: string): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTServer {
  connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: string): Promise<BluetoothRemoteGATTService>
}

interface BluetoothDevice {
  readonly name?: string
  readonly gatt?: BluetoothRemoteGATTServer
}

interface RequestDeviceOptions {
  filters?: { services?: string[] }[]
  optionalServices?: string[]
  acceptAllDevices?: boolean
}

interface Bluetooth {
  requestDevice(options: RequestDeviceOptions): Promise<BluetoothDevice>
}

interface Navigator {
  usb?: USB
  bluetooth?: Bluetooth
}
