#![no_std]
#![no_main]

use cortex_m_rt::entry;
use defmt_rtt as _;
use panic_probe as _;

#[link_section = ".boot2"]
#[used]
pub static BOOT2_FIRMWARE: [u8; 256] = rp2040_boot2::BOOT_LOADER_GENERIC_03H;

#[entry]
fn main() -> ! {
    let mut n: u32 = 0;
    loop {
        defmt::info!("Hello from SiliconForge on Seeed XIAO RP2040: {}", n);
        n = n.wrapping_add(1);
        cortex_m::asm::delay(133000000);
    }
}
