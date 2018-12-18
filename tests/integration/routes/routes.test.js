const mongoose = require("mongoose");
const moment = require("moment");
const { Genre } = require("../../../models/genre");
const { User } = require("../../../models/user");
const { Rental } = require("../../../models/rental");
const { Movie } = require("../../../models/movie");
const request = require("supertest");
const bcrypt = require("bcrypt");
let server;

describe("/api/genres", () => {
  beforeEach(() => {
    server = require("../../../index");
  });

  afterEach(async () => {
    await server.close();
    await Genre.remove({});
  });

  describe("GET /", () => {
    it("should return all genres", async () => {
      await Genre.collection.insertMany([
        { name: "genre1" },
        { name: "genre2" }
      ]);

      const res = await request(server).get("/api/genres");

      expect(res.status).toBe(200);
      expect(res.body.some(g => g.name === "genre1")).toBeTruthy();
      expect(res.body.some(g => g.name === "genre2")).toBeTruthy();
    });
  });

  describe("GET /:id", () => {
    it("should return 404 if invalid genreID is passed", async () => {
      const res = await request(server).get("/api/genres/1");
      expect(res.status).toBe(404);
    });

    it("should return 404 if genre with the given ID was not found", async () => {
      const id = new mongoose.Types.ObjectId();

      const res = await request(server).get("/api/genres/" + id);
      expect(res.status).toBe(404);
    });

    it("should return the genre if valid ID is passed", async () => {
      const genre = new Genre({
        name: "genre1"
      });
      await genre.save();

      const res = await request(server).get("/api/genres/" + genre._id);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("name", "genre1");
    });
  });

  describe("POST /", () => {
    let name;
    let token;

    const exec = () => {
      return request(server)
        .post("/api/genres")
        .set("x-auth-token", token)
        .send({ name });
    };

    beforeEach(() => {
      name = "genre1";
      token = new User().generateAuthToken();
    });

    it("should return 401 if client is not logged in", async () => {
      token = "";
      const res = await exec();

      expect(res.status).toBe(401);
    });

    it("should return 400 if genre name is less than 5 characters", async () => {
      name = "1234";
      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 400 if genre name is more than 50 characters", async () => {
      name = new Array(52).join("a");
      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should save the genre if it's valid", async () => {
      await exec();
      const genre = await Genre.find({ name: "genre1" });

      expect(genre).not.toBeNull();
    });

    it("should return the genre if it's valid", async () => {
      const res = await exec();

      expect(res.body).toHaveProperty("_id");
      expect(res.body).toHaveProperty("name", "genre1");
    });
  });

  describe("PUT /:id", () => {
    let token;
    let name;
    let _id;

    const exec = () => {
      return request(server)
        .put("/api/genres/" + _id)
        .set("x-auth-token", token)
        .send({ name });
    };

    beforeEach(async () => {
      const genre = new Genre({ name: "genre1" });
      await genre.save();
      _id = genre._id;
      token = new User().generateAuthToken();
      name = "genre2";
    });

    it("should return 401 if client is not logged in", async () => {
      token = "";
      const res = await exec();

      expect(res.status).toBe(401);
    });

    it("should return 404 if invalid ObjectId is passed", async () => {
      _id = "1";
      const res = await exec();

      expect(res.status).toBe(404);
    });

    it("should return 404 if no genre with the given Id is found", async () => {
      _id = new mongoose.Types.ObjectId();
      const res = await exec();

      expect(res.status).toBe(404);
    });

    it("should return 400 if genre name is less than 5 characters", async () => {
      name = "1234";
      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 400 if genre name is more than 50 characters", async () => {
      name = new Array(52).join("b");
      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should update the genre in the db", async () => {
      await exec();
      const res = await Genre.findById(_id);

      expect(res).toHaveProperty("name", "genre2");
    });

    it("should return the updated genre", async () => {
      const res = await exec();

      expect(res.body).toHaveProperty("_id");
      expect(res.body).toHaveProperty("name", "genre2");
    });
  });

  describe("DELETE /:id", () => {
    let token;
    let _id;

    const exec = () => {
      return request(server)
        .delete("/api/genres/" + _id)
        .set("x-auth-token", token);
    };

    beforeEach(async () => {
      const genre = new Genre({ name: "genre" });
      await genre.save();
      _id = genre.id;
      token = new User({ isAdmin: true }).generateAuthToken();
    });

    it("should return 401 if the client is not logged in", async () => {
      token = "";
      const res = await exec();

      expect(res.status).toBe(401);
    });

    it("should return 403 if the access is forbidden", async () => {
      token = new User().generateAuthToken();
      const res = await exec();

      expect(res.status).toBe(403);
    });

    it("should return 404 if the ObjectId is invalid", async () => {
      _id = "";
      const res = await exec();

      expect(res.status).toBe(404);
    });

    it("should return 404 if no genre with the given Id was found", async () => {
      _id = new mongoose.Types.ObjectId();
      const res = await exec();

      expect(res.status).toBe(404);
    });

    it("should remove the genre from the db", async () => {
      await exec();

      const res = await Genre.findById(_id);
      expect(res).toBeNull();
    });

    it("should return the deleted genre to the client", async () => {
      const res = await exec();

      expect(res.body).toHaveProperty("name", "genre");
    });
  });
});

describe("/api/auth", () => {
  beforeEach(() => {
    server = require("../../../index");
  });

  afterEach(async () => {
    await server.close();
    await User.remove({});
  });

  describe("POST /", () => {
    let user;
    let email;
    let password;
    let token;

    const exec = () => {
      return request(server)
        .post("/api/auth")
        .send({ email, password });
    };

    beforeEach(async () => {
      user = new User({
        name: "Traian M.",
        email: "traian.mihali01@gmail.com",
        password: "12345"
      });
      email = user.email;
      password = user.password;

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(user.password, salt);
      token = user.generateAuthToken();
      await user.save();
    });

    it("should return 400 if req.body.email is invalid", async () => {
      email = "";
      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 400 if req.body.password is invalid", async () => {
      password = "";
      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 400 if email is invalid", async () => {
      email = "traian.mihali02@gmail.com";
      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 400 if password is invalid", async () => {
      password = "123456";
      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 200 if the user is authenticated", async () => {
      user = await User.findById(user._id);
      const res = await exec();

      expect(user).toHaveProperty("name", "Traian M.");
      expect(user).toHaveProperty("email", "traian.mihali01@gmail.com");
      expect(user).toHaveProperty("password");
      expect(res.status).toBe(200);
    });
  });
});

describe("auth middleware", () => {
  let token;

  beforeEach(() => {
    server = require("../../../index");
    token = new User().generateAuthToken();
  });

  afterEach(async () => {
    await Genre.remove({});
    await server.close();
  });

  const exec = () => {
    return request(server)
      .post("/api/genres")
      .set("x-auth-token", token)
      .send({ name: "genre3" });
  };

  it("should return 401 if no token was provided", async () => {
    token = "";
    const res = await exec();
    expect(res.status).toBe(401);
  });

  it("should return 400 if token is invalid", async () => {
    token = "a";
    const res = await exec();
    expect(res.status).toBe(400);
  });

  it("should return 200 if token is valid", async () => {
    const res = await exec();
    expect(res.status).toBe(200);
  });
});

describe("/api/returns", () => {
  let rental;
  let customerId;
  let movieId;
  let movie;
  let token;

  beforeEach(() => {
    server = require("../../../index");
  });
  afterEach(async () => {
    await server.close();
    await Rental.remove({});
    await Movie.remove({});
  });
  describe("POST /", () => {
    const exec = () => {
      return request(server)
        .post("/api/returns")
        .set("x-auth-token", token)
        .send({ customerId, movieId });
    };

    beforeEach(async () => {
      customerId = mongoose.Types.ObjectId();
      movieId = mongoose.Types.ObjectId();
      token = new User().generateAuthToken();

      movie = new Movie({
        _id: movieId,
        title: "12345",
        dailyRentalRate: 2,
        genre: { name: "12345" },
        numberInStock: 10
      });
      await movie.save();

      rental = new Rental({
        customer: {
          _id: customerId,
          name: "12345",
          phone: "12345"
        },
        movie: {
          _id: movieId,
          title: "12345",
          dailyRentalRate: 2
        }
      });
      await rental.save();
    });

    it("should return 401 if client is not logged in", async () => {
      token = "";

      const res = await exec();

      expect(res.status).toBe(401);
    });

    it("should return 400 if customerId is not provided", async () => {
      customerId = "";

      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 400 if movieId is not provided", async () => {
      movieId = "";

      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 404 if no rental found for the customer/movie", async () => {
      await Rental.remove({});

      const res = await exec();

      expect(res.status).toBe(404);
    });

    it("should return 400 if return is already processed", async () => {
      rental.dateReturned = new Date();
      await rental.save();

      const res = await exec();

      expect(res.status).toBe(400);
    });

    it("should return 200 if we have a valid request", async () => {
      const res = await exec();

      expect(res.status).toBe(200);
    });

    it("should set the returnDate if input is valid", async () => {
      const res = await exec();

      const rentalInDb = await Rental.findById(rental._id);
      const diff = new Date() - rentalInDb.dateReturned;
      expect(diff).toBeLessThan(10 * 1000);
    });

    it("should set the rentalFee if input is valid", async () => {
      rental.dateOut = moment()
        .add(-7, "days")
        .toDate();
      await rental.save();

      const res = await exec();

      const rentalInDb = await Rental.findById(rental._id);
      expect(rentalInDb.rentalFee).toBe(14);
    });

    it("should increase the movie stock if input is valid", async () => {
      const res = await exec();

      const movieInDb = await Movie.findById(movieId);
      expect(movieInDb.numberInStock).toBe(movie.numberInStock + 1);
    });

    it("should return the rental if input is valid", async () => {
      const res = await exec();

      const rentalInDb = await Rental.findById(rental._id);

      expect(Object.keys(res.body)).toEqual(
        expect.arrayContaining([
          "dateOut",
          "dateReturned",
          "rentalFee",
          "customer",
          "movie"
        ])
      );
    });
  });
});
