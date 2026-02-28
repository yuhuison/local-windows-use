import { Monitor } from 'node-screenshots';

const monitors = Monitor.all();
const primary = monitors.find((m) => m.isPrimary()) ?? monitors[0];

console.log('Monitor properties:');
for (const key of Object.getOwnPropertyNames(Object.getPrototypeOf(primary))) {
  console.log(`  ${key}: ${typeof (primary as any)[key]} = ${(primary as any)[key]}`);
}
console.log('\nOwn keys:', Object.keys(primary));
console.log('JSON:', JSON.stringify(primary));

const image = primary.captureImageSync();
console.log('\nImage width:', image.width);
console.log('Image height:', image.height);
console.log('primary.width():', (primary as any).width());
console.log('primary.height():', (primary as any).height());
console.log('primary.scaleFactor():', (primary as any).scaleFactor());
const sf = (primary as any).scaleFactor();
console.log('logicalW:', Math.round(image.width / sf));
console.log('logicalH:', Math.round(image.height / sf));
