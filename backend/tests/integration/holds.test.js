//1.Start Testcontainer, create pool, run migrations, initialize service.
//2.Reset database and seed fresh test data.
//3.Test 1: 200 attempts against 10 seats.
//4.Test 2: Expire a hold manually and attempt a new hold.
//5.Test 3: Attempt to hold multiple seats when one is unavailable.
//6.Close pool and stop PostgreSQL container.
