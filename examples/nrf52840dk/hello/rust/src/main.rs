#![no_std]
#![no_main]

use cortex_m_rt::entry;
use defmt_rtt as _;
use panic_probe as _;

#[entry]
fn main() -> ! {
    let mut n: u32 = 0;
    loop {
        defmt::info!("Hello from SiliconForge on Nordic nRF52840 DK: {}", n);
        n = n.wrapping_add(1);
        cortex_m::asm::delay(64000000);
    }
}
