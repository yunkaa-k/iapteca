/* eslint-disable @typescript-eslint/no-require-imports */
const mongoose = require('mongoose');

const medicationSchema = new mongoose.Schema({
  name: String,
  description: String,
  price: Number,
  stock: Number,
  category: String,
  manufacturer: String,
  isDeleted: { type: Boolean, default: false },
});

const categorySchema = new mongoose.Schema({
  name: String,
});

const userSchema = new mongoose.Schema({
  phone: String,
  role: String,
});

const orderSchema = new mongoose.Schema({
  user: String,
});

const Medication = mongoose.models.Medication || mongoose.model('Medication', medicationSchema);
const Category = mongoose.models.Category || mongoose.model('Category', categorySchema);
const User = mongoose.models.User || mongoose.model('User', userSchema);
const Order = mongoose.models.Order || mongoose.model('Order', orderSchema);

async function prepare() {
  const uri = "mongodb://localhost:27017/iapteca?replicaSet=rs0&directConnection=true";
  try {
    await mongoose.connect(uri);
    console.log('Connected to MongoDB');

    // 1. Clean up
    console.log('Cleaning database...');
    await Medication.deleteMany({});
    await Category.deleteMany({});
    await Order.deleteMany({});
    await User.deleteMany({});

    // 2. Seed
    console.log('Seeding 500 medications for k6...');
    const medicationsData = [];
    const prefixes = ['Супер', 'Мега', 'Ультра', 'Анти', 'Біо', 'Фіто', 'Еко', 'Макс', 'Норм', 'Віта'];
    const names = ['циклін', 'грип', 'зол', 'дин', 'мол', 'фен', 'віт', 'зин', 'спаз', 'дин'];
    
    for (let i = 1; i <= 500; i++) {
      medicationsData.push({
        name: `${prefixes[i % 10]}${names[Math.floor(i / 10) % 10]} ${i}`,
        description: `Тестовий препарат №${i} для нагрузочного тестування`,
        price: 10 + (i % 50),
        stock: 1000000,
        category: i % 3 === 0 ? 'Знеболювальні' : (i % 3 === 1 ? 'Вітаміни' : 'Антибіотики'),
        manufacturer: i % 2 === 0 ? 'Фармак' : 'Дарниця',
        isDeleted: false
      });
    }
    await Medication.insertMany(medicationsData);

    console.log('Database prepared for k6 successfully');
  } catch (err) {
    console.error('Preparation failed:', err);
  } finally {
    await mongoose.connection.close();
  }
}

prepare();
