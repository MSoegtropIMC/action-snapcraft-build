// -*- mode: javascript; js-indent-level: 2 -*-

import * as core from '@actions/core'
import * as exec from '@actions/exec'
import * as fs from 'fs'
import * as os from 'os'

async function haveExecutable(path: string): Promise<boolean> {
  try {
    await fs.promises.access(path, fs.constants.X_OK)
  } catch (err) {
    return false
  }
  return true
}


async function hasFileTimeout(path : string, timeout_s : number) {
  let time_s = 0; 

  return await new Promise<boolean>((resolve, reject) => {
    const timer = setInterval(function() {
      time_s += 1;
    
      let fileExists = fs.existsSync(path);
  
      if (fileExists || time_s >= timeout_s) {
        clearInterval(timer);
        resolve(fileExists);
      }
    }, 1000);
  });
}

export async function ensureSnapd(): Promise<void> {
  const haveSnapd = await haveExecutable('/usr/bin/snap')
  if (!haveSnapd) {
    core.info('Installing snapd...')
    await exec.exec('sudo', ['apt-get', 'update', '-q'])
    await exec.exec('sudo', ['apt-get', 'install', '-qy', 'snapd'])
  }
  // The Github worker environment has weird permissions on the root,
  // which trip up snap-confine.
  const root = await fs.promises.stat('/')
  if (root.uid !== 0 || root.gid !== 0) {
    await exec.exec('sudo', ['chown', 'root:root', '/'])
  }
}

export async function ensureMultipass(): Promise<void> {
  const haveMultipass = await haveExecutable('/snap/bin/multipass')
  core.info('Installing Multipass...')
  await exec.exec('sudo', [
    'snap',
    haveMultipass ? 'refresh' : 'install',
    'multipass'
  ])
  // Wait until multipass started up - usually this takes 3..5 seconds
  await hasFileTimeout('/var/snap/multipass/common/multipass_socket', 60)
  // Check permissions
  await exec.exec('ls', ['-l', '/var/snap/multipass/common/multipass_socket'])
  await exec.exec('groups')
  await exec.exec('whoami')
  // Add user to 'sudo' group
  await exec.exec('sudo', ['usermod', '-a', '-G', 'sudo', 'runner'])
  // switch group hence and forth to activate it
  await exec.exec('groups')
  await exec.exec('newgrp', ['sudo'])
  await exec.exec('newgrp', [])
  await exec.exec('groups')
}

export async function ensureSnapcraft(channel: string): Promise<void> {
  const haveSnapcraft = await haveExecutable('/snap/bin/snapcraft')
  core.info('Installing Snapcraft...')
  await exec.exec('sudo', [
    'snap',
    haveSnapcraft ? 'refresh' : 'install',
    '--channel',
    channel,
    '--classic',
    'snapcraft'
  ])
}
